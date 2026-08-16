"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * La subida de fotos, sin nada de cómo se dibuja.
 *
 * Vivía adentro de photo-uploader.tsx. Salió a un hook cuando el panel nuevo
 * necesitó su propio soltador: copiar el firmado por lotes, la cola de diez
 * obreros y el commit habría dejado dos implementaciones de lo mismo, y la que
 * se toque menos es la que se va a romper sin que nadie se entere. Lo que
 * cambia entre los dos paneles es el dibujo, no cómo se sube.
 *
 * Lo que trae además del pedido: se vigila que cada subida AVANCE y no cuánto
 * tarda, se reintenta hasta dos veces lo que falla por conexión, y lo que no se
 * pudo subir queda con su motivo para poder mostrarlo.
 */
export type ItemSubida = {
  localId: string;
  file: File;
  thumbDataUrl?: string;
  photoId?: string;
  state: "pending" | "uploading" | "complete" | "failed";
  pct: number;
  error?: string;
  /** En qué intento va. Se muestra sólo cuando es más de uno. */
  intentos?: number;
  /** Se dibuja como celda en la grilla; el resto cae en el "+X". */
  visible: boolean;
};

// S3 es otro host, así que los PUT no comparten el presupuesto de conexiones
// por origen del navegador con nuestras propias llamadas a la API.
const MAX_PARALELO = 10;
const MAX_CELDAS = 11; // la grilla muestra hasta 11 celdas + una de "+X"
const FIRMA_POR_TANDA = 50; // tope de la API por pedido

/** Sin avanzar tanto tiempo, se corta y se reintenta. Es tiempo SIN progreso,
 *  no tiempo total: una foto de 30 MB con poca subida tarda minutos y está
 *  bien que tarde. */
const SIN_AVANCE_MS = 45_000;

/** Tope para el commit, que es un POST chico contra nuestro servidor. */
const COMMIT_MS = 30_000;

/** Reintentos por foto, además del primer intento. */
const REINTENTOS = 2;
const ESPERA_BASE_MS = 800;

export const ACEPTADOS = "image/jpeg,image/png,image/webp";

export function useSubida(
  eventId: string,
  opciones?: {
    /**
     * Cuántas miniaturas generar. Sólo las que se van a dibujar.
     *
     * Generarlas cuesta caro y se pagaba SIEMPRE: cada archivo se leía entero y
     * se codificaba en base64 antes de pedir la primera URL firmada. Trescientas
     * fotos de 6 MB son 2,4 GB de texto en memoria, retenidos en el estado
     * durante toda la subida y compitiendo con la subida misma. El panel viejo
     * dibuja once; el soltador del panel nuevo, ninguna.
     */
    miniaturas?: number;
    /** Tope por foto. Los que se pasan no entran, en vez de voltear su tanda. */
    maxBytes?: number;
  },
) {
  const miniaturasHasta = opciones?.miniaturas ?? 0;
  const maxBytes = opciones?.maxBytes ?? Infinity;
  const router = useRouter();
  const [items, setItems] = useState<ItemSubida[]>([]);

  const total = items.length;
  const hechas = items.filter((i) => i.state === "complete").length;
  const fallidas = items.filter((i) => i.state === "failed").length;
  const cerrado = total > 0 && hechas + fallidas === total;
  const fase: "idle" | "uploading" | "done" =
    total === 0 ? "idle" : cerrado ? "done" : "uploading";
  const pct = total > 0 ? Math.round((hechas / total) * 100) : 0;

  function uno(localId: string, patch: Partial<ItemSubida>) {
    setItems((prev) => prev.map((p) => (p.localId === localId ? { ...p, ...patch } : p)));
  }

  async function miniatura(f: File): Promise<string | undefined> {
    if (!f.type.startsWith("image/")) return undefined;
    return new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => resolve(undefined);
      r.readAsDataURL(f);
    });
  }

  /**
   * Devuelve cuántos archivos entraron y cuántos quedaron afuera.
   *
   * Los descartados importan: si alguien suelta una carpeta de HEIC del iPhone,
   * el filtro se los come a todos y sin este número la pantalla no hace
   * absolutamente nada, que es indistinguible de estar rota.
   */
  async function agregar(list: FileList | File[]) {
    const todos = Array.from(list);
    const tipoOk = todos.filter((f) => ACEPTADOS.split(",").includes(f.type));
    // El tamaño se filtra ACÁ y no en el servidor: la API rechaza el pedido
    // entero si un solo archivo se pasa, así que una foto de 40 MB en el medio
    // volteaba las otras cuarenta y nueve de su tanda.
    const arr = tipoOk.filter((f) => f.size <= maxBytes);
    const grandes = tipoOk.length - arr.length;
    const afuera = todos.length - tipoOk.length;
    if (arr.length === 0) return { entraron: 0, afuera, grandes };

    const base = items.length;
    const nuevos: ItemSubida[] = await Promise.all(
      arr.map(async (file, idx) => ({
        localId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${idx}`,
        file,
        // Sólo las que se van a ver. El resto ni se lee.
        thumbDataUrl: base + idx < miniaturasHasta ? await miniatura(file) : undefined,
        state: "pending" as const,
        pct: 0,
        visible: base + idx < MAX_CELDAS,
      })),
    );

    setItems((prev) =>
      [...prev, ...nuevos].map((it, i) => ({ ...it, visible: i < MAX_CELDAS })),
    );

    void procesar(nuevos);
    return { entraron: arr.length, afuera, grandes };
  }

  async function procesar(aProcesar: ItemSubida[]) {
    type Firmada = { photoId: string; uploadUrl: string; contentType: string };

    // La cola se llena mientras se sube, no antes.
    //
    // Antes se firmaba TODO y recién después arrancaba la primera subida. La
    // API firma de a 50, así que 300 fotos eran seis viajes al servidor, uno
    // atrás del otro, sin subir un solo byte mientras tanto. Ahora la primera
    // tanda de 50 alcanza para poner a trabajar a los diez obreros, y el resto
    // se va firmando en paralelo con la subida.
    const cola: Array<{ b: ItemSubida; p: Firmada }> = [];
    let firmando = true;
    let cursor = 0;

    async function firmar() {
      try {
        for (let i = 0; i < aProcesar.length; i += FIRMA_POR_TANDA) {
          const tanda = aProcesar.slice(i, i + FIRMA_POR_TANDA);
          const res = await fetch(`/api/dashboard/events/${eventId}/photos/presign`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              files: tanda.map((b) => ({
                name: b.file.name,
                size: b.file.size,
                mimeType: b.file.type,
              })),
            }),
            // Sin tope, un servidor que no contesta deja la tanda esperando
            // para siempre y ni siquiera llega a mostrarse el error.
            signal: AbortSignal.timeout(COMMIT_MS),
          });
          if (!res.ok) {
            const data = (await res.json().catch(() => ({}))) as { error?: string };
            const msg = data.error ?? "Error al iniciar la subida";
            // Sólo las que todavía no se firmaron. Antes se marcaban como
            // fallidas TODAS, incluidas las que ya estaban arriba.
            aProcesar.slice(i).forEach((b) => uno(b.localId, { state: "failed", error: msg }));
            return;
          }
          const data = (await res.json()) as { items: Firmada[] };
          data.items.forEach((p, k) => {
            const b = tanda[k];
            if (b) cola.push({ b, p });
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Red caída";
        aProcesar
          .slice(cola.length)
          .forEach((b) => uno(b.localId, { state: "failed", error: msg }));
      } finally {
        firmando = false;
      }
    }

    const firmas = firmar();

    // Cola de obreros: arrancan MAX_PARALELO y cada uno, al terminar, agarra el
    // siguiente. Una foto lenta no frena al resto, que es lo que importa cuando
    // la tanda mezcla archivos de 2 MB con otros de 20.
    async function obrero() {
      while (true) {
        if (cursor >= cola.length) {
          // Sin trabajo: o ya está todo, o falta que llegue la próxima firma.
          if (!firmando) return;
          await new Promise((r) => setTimeout(r, 50));
          continue;
        }
        const idx = cursor++;
        const { b, p } = cola[idx]!;

        // Hasta tres intentos, esperando cada vez un poco más. Casi todo lo que
        // falla en una tanda grande es la conexión pestañeando, y volver a
        // intentar una vez arregla más que cualquier mensaje de error.
        for (let intento = 0; ; intento++) {
          uno(b.localId, {
            state: "uploading",
            photoId: p.photoId,
            pct: 0,
            intentos: intento + 1,
            error: undefined,
          });
          try {
            await ponerConProgreso({
              url: p.uploadUrl,
              file: b.file,
              contentType: p.contentType,
              // Se topea en 99: el 100 se pone recién cuando el commit contestó.
              // Un 100 mientras todavía puede fallar es una mentira barata.
              alAvanzar: (n) => uno(b.localId, { pct: Math.min(99, n) }),
            });

            const cm = await fetch(
              `/api/dashboard/events/${eventId}/photos/${p.photoId}/commit`,
              // El commit es un POST chico, pero sin tope se cuelga igual que
              // la subida. Es idempotente, así que reintentarlo no duplica
              // nada: si la foto ya tenía tamaño, contesta ok y listo.
              { method: "POST", signal: AbortSignal.timeout(COMMIT_MS) },
            );
            if (!cm.ok) {
              const data = (await cm.json().catch(() => ({}))) as { error?: string };
              throw new FalloSubida(data.error ?? `El servidor respondió ${cm.status}`, cm.status >= 500);
            }
            uno(b.localId, { state: "complete", pct: 100 });
            break;
          } catch (err) {
            const fallo =
              err instanceof FalloSubida
                ? err
                : new FalloSubida(
                    err instanceof Error && err.name === "TimeoutError"
                      ? "El servidor no contestó"
                      : err instanceof Error
                        ? err.message
                        : "Error",
                    true,
                  );

            if (!fallo.transitorio || intento >= REINTENTOS) {
              uno(b.localId, { state: "failed", error: fallo.message, intentos: intento + 1 });
              break;
            }
            // Espera creciente: si S3 está saturado, diez obreros reintentando
            // al mismo tiempo lo saturan más.
            await new Promise((r) => setTimeout(r, ESPERA_BASE_MS * Math.pow(2, intento)));
          }
        }
      }
    }

    // Se arrancan tantos obreros como fotos haya, con tope de MAX_PARALELO. No
    // se mira cola.length porque en este momento está vacía: se llena mientras
    // corren. Mirarla acá dejaría cero obreros y no subiría nada.
    await Promise.all(
      Array.from({ length: Math.min(MAX_PARALELO, aProcesar.length) }, () => obrero()),
    );
    await firmas;

    // Vuelve a pedir la pantalla para que aparezcan las fotos recién subidas.
    router.refresh();
  }

  /**
   * Vuelve a intentar sólo las que fallaron.
   *
   * Se piden URLs nuevas en vez de reusar las viejas: la firma pudo haber
   * vencido, y ése es justamente uno de los motivos por los que se falla. Las
   * filas de Photo que quedaron a medias no molestan, porque la pantalla sólo
   * muestra las que tienen tamaño y el commit borra las que nunca llegaron.
   */
  function reintentar() {
    const archivos = items.filter((i) => i.state === "failed").map((i) => i.file);
    if (archivos.length === 0) return;
    setItems((prev) => prev.filter((i) => i.state !== "failed"));
    void agregar(archivos);
  }

  return {
    items,
    total,
    hechas,
    fallidas,
    cerrado,
    fase,
    pct,
    agregar,
    reintentar,
    /** Las que no se pudieron subir, con el motivo. */
    conFallo: items.filter((i) => i.state === "failed"),
    limpiar: () => setItems([]),
  };
}

/**
 * Un fallo del que tiene sentido reintentar, y uno del que no.
 *
 * Una conexión cortada o un 503 de S3 se arreglan solos al segundo intento. Un
 * 403 por firma vencida o un archivo rechazado van a fallar las tres veces
 * igual, y reintentarlos es hacer esperar al fotógrafo por nada.
 */
class FalloSubida extends Error {
  constructor(
    mensaje: string,
    readonly transitorio: boolean,
  ) {
    super(mensaje);
  }
}

function ponerConProgreso(opts: {
  url: string;
  file: File;
  contentType: string;
  alAvanzar: (pct: number) => void;
}): Promise<void> {
  // XMLHttpRequest y no fetch: fetch todavía no informa progreso de subida en
  // los navegadores que nos importan, y sin progreso una tanda de 400 fotos es
  // una pantalla quieta durante varios minutos.
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    // Se vigila que AVANCE, no cuánto tarda en total.
    //
    // xhr.timeout es un tope al tiempo total, y acá no sirve: una foto de 30 MB
    // con poca subida tarda minutos legítimamente, y cualquier número que la
    // deje pasar es tan grande que ya no protege de nada. Esto en cambio corta
    // cuando deja de moverse, que es lo que pasa cuando la conexión se cuelga.
    //
    // Antes ontimeout estaba enganchado pero xhr.timeout nunca se seteaba, así
    // que no disparaba nunca: una subida colgada dejaba ese obrero trabado para
    // siempre y la tanda entera no terminaba jamás.
    let reloj: ReturnType<typeof setTimeout> | undefined;
    const rearmar = () => {
      clearTimeout(reloj);
      reloj = setTimeout(() => {
        xhr.abort();
        reject(new FalloSubida(`Se quedó sin avanzar ${SIN_AVANCE_MS / 1000}s`, true));
      }, SIN_AVANCE_MS);
    };
    const parar = () => clearTimeout(reloj);

    xhr.upload.onprogress = (e) => {
      rearmar();
      if (e.lengthComputable) opts.alAvanzar(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onerror = () => {
      parar();
      reject(new FalloSubida("Se cortó la conexión", true));
    };
    xhr.ontimeout = () => {
      parar();
      reject(new FalloSubida("Tardó demasiado", true));
    };
    xhr.onabort = () => parar();
    xhr.onload = () => {
      parar();
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      // 5xx y 429 son de S3 teniendo un mal momento y pasan solos. Un 4xx es la
      // firma vencida o el archivo rechazado: reintentar no lo va a arreglar.
      const transitorio = xhr.status >= 500 || xhr.status === 429 || xhr.status === 0;
      reject(new FalloSubida(`S3 respondió ${xhr.status}`, transitorio));
    };
    xhr.open("PUT", opts.url);
    xhr.setRequestHeader("Content-Type", opts.contentType);
    rearmar();
    xhr.send(opts.file);
  });
}
