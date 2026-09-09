"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

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

/**
 * Cuánto se le da a un XHR para mandar su PRIMER byte.
 *
 * El reloj de arriba no sirve para el arranque, y ahí estaba el bug: se armaba
 * antes del send, y el navegador permite seis conexiones por host, así que con
 * diez obreros hay cuatro XHR ENCOLADOS que no mandan nada porque todavía no
 * les toca. A los 45 segundos se abortaban solos sin haber transmitido un byte,
 * gastaban sus tres intentos y la foto se marcaba fallida. En un enlace lento
 * eso pasa siempre.
 */
const SIN_ARRANCAR_MS = 120_000;

/**
 * Cuántas URLs firmadas puede haber esperando su turno.
 *
 * Es LA constante de este archivo. Antes no existía: se firmaba todo de una,
 * los diez obreros consumían en orden, y la última firma de una tanda de 2.000
 * esperaba horas. Con cien, a 16 fotos por minuto la más vieja tiene seis
 * minutos cuando le toca; contra una hora de vida, sobra.
 */
const VENTANA_FIRMADAS = 100;

/** Refirmas por foto antes de darla por perdida. */
const REFIRMAS_MAX = 2;

/**
 * Reintentos del COMMIT, aparte de los de la subida.
 *
 * El commit es un POST de doscientos bytes contra nuestro servidor, y el
 * archivo ya está arriba. Reintentarlo no cuesta nada; volver a subir 15 MB
 * porque el servidor estaba reiniciándose, sí. Y un `pm2 restart` tarda más
 * que los cinco segundos que daban los tres reintentos de la subida.
 */
const COMMIT_REINTENTOS = 5;
const COMMIT_ESPERAS_MS = [2_000, 4_000, 8_000, 16_000, 30_000];

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
    /**
     * Modo demo: recorre los mismos estados sin tocar la red.
     *
     * Lo usa /demo/subida, que muestra este mismo soltador operándose solo para
     * poder grabarlo. Va acá y no en el componente porque la máquina de estados
     * —pendiente, subiendo con su porcentaje, lista— vive en este hook: fingirla
     * desde afuera daría una animación parecida pero no las mismas pantallas.
     */
    simulado?: boolean;
  },
) {
  const simulado = opciones?.simulado ?? false;
  const miniaturasHasta = opciones?.miniaturas ?? 0;
  const maxBytes = opciones?.maxBytes ?? Infinity;
  const router = useRouter();
  const [items, setItems] = useState<ItemSubida[]>([]);

  /**
   * Cuándo terminó cada foto, para poder decir cuánto falta.
   *
   * Una ventana móvil de dos minutos y no el promedio desde el arranque: en una
   * tanda de dos horas el promedio total tarda muchísimo en reflejar que la
   * conexión mejoró o empeoró, y el número que el fotógrafo mira para decidir
   * si se queda o se va a hacer otra cosa tiene que responder a lo que está
   * pasando ahora.
   */
  const terminadas = useRef<number[]>([]);
  const ultimoPct = useRef<Map<string, number>>(new Map());

  const total = items.length;
  const hechas = items.filter((i) => i.state === "complete").length;
  const fallidas = items.filter((i) => i.state === "failed").length;
  const cerrado = total > 0 && hechas + fallidas === total;
  const fase: "idle" | "uploading" | "done" =
    total === 0 ? "idle" : cerrado ? "done" : "uploading";
  const pct = total > 0 ? Math.round((hechas / total) * 100) : 0;

  /* Ritmo y tiempo restante. Sólo con muestra suficiente: con tres fotos
     terminadas cualquier número es ruido, y un "faltan 6 horas" que a los dos
     minutos dice "faltan 40" es peor que no decir nada. */
  const ahoraMs = Date.now();
  const recientes = terminadas.current.filter((t) => ahoraMs - t < 120_000);
  const ritmoPorMin =
    recientes.length >= 8
      ? Math.max(1, Math.round((recientes.length / 120) * 60))
      : null;
  const faltan = total - hechas - fallidas;
  const etaMs = ritmoPorMin && faltan > 0 ? (faltan / ritmoPorMin) * 60_000 : null;

  function uno(localId: string, patch: Partial<ItemSubida>) {
    setItems((prev) => prev.map((p) => (p.localId === localId ? { ...p, ...patch } : p)));
  }

  /**
   * El porcentaje de UNA foto, sin repintar la lista entera cada vez.
   *
   * `uno()` hace un map sobre todos los items. Con diez subidas en paralelo
   * llegan unos doscientos eventos de progreso por segundo, y con dos mil fotos
   * en la lista eso son cuatrocientas mil copias de objeto por segundo, durante
   * las horas que dura la tanda, para mover una barra que sólo mira
   * hechas/total.
   *
   * Así que el progreso por archivo se limita a uno cada 400 ms. La barra
   * general no lo nota —depende de las fotos terminadas, no del porcentaje de
   * cada una— y la que sí lo muestra por celda se mueve igual de fluido a ese
   * ritmo.
   */
  function avance(localId: string, pct: number) {
    const t = Date.now();
    const previo = ultimoPct.current.get(localId) ?? 0;
    if (pct < 99 && t - previo < 400) return;
    ultimoPct.current.set(localId, t);
    uno(localId, { pct });
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
    if (simulado) return procesarFingido(aProcesar);
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
    /** Se levanta si ya no hay obreros vivos: la ventana no puede girar sola. */
    let cortado = false;

    async function firmar() {
      try {
        /* Las que YA tienen fila no se vuelven a firmar: se les pide otra
           autorización para la misma clave.

           Sin esto, "Reintentar" crearía una fila y un objeto nuevos por cada
           foto que ya tenía los suyos —que es exactamente el bug que llenó la
           base de huérfanas— y, si la primera subida había llegado, publicaría
           la misma foto dos veces. */
        const conFila = aProcesar.filter((b) => b.photoId);
        for (const b of conFila) {
          if (cortado) return;
          const nueva = await refirmar(b.photoId!, b.file.size);
          if (nueva === "ya") {
            uno(b.localId, { state: "complete", pct: 100 });
          } else if (nueva) {
            cola.push({
              b,
              p: { photoId: b.photoId!, uploadUrl: nueva.uploadUrl, contentType: nueva.contentType },
            });
          } else {
            uno(b.localId, { state: "failed", error: "No se pudo renovar la autorización" });
          }
        }

        const nuevas = aProcesar.filter((b) => !b.photoId);
        for (let i = 0; i < nuevas.length; i += FIRMA_POR_TANDA) {
          /* La ventana deslizante: no firmar más de lo que se va a usar pronto.

             Acá estaba el techo de las subidas grandes. Se firmaba TODO de una
             en los primeros segundos y los obreros consumían en orden, así que
             la firma número 300 esperaba su turno media hora y llegaba vencida.
             Ahora nunca hay más de VENTANA_FIRMADAS esperando, así que ninguna
             envejece: cuando le toca, se firmó hace minutos.

             El chequeo va ANTES de pedir la tanda y cuenta la tanda que está por
             pedir. Escrito al revés —comparando sólo lo que ya hay— la cota real
             sería VENTANA + TANDA − 1. */
          while (
            // Con la cola vacía se firma siempre, pase lo que pase con las
            // constantes: si alguien pusiera VENTANA_FIRMADAS por debajo de
            // FIRMA_POR_TANDA, la condición de abajo sería cierta para siempre
            // y esto giraría sin que nadie suba nada.
            cola.length - cursor > 0 &&
            cola.length - cursor + FIRMA_POR_TANDA > VENTANA_FIRMADAS
          ) {
            if (cortado) return;
            await new Promise((r) => setTimeout(r, 250));
          }
          if (cortado) return;

          const tanda = nuevas.slice(i, i + FIRMA_POR_TANDA);
          const firmadas = await firmarTanda(tanda);
          if (!firmadas) {
            /* Sólo esta tanda, y se sigue con la próxima.

               Antes un fallo marcaba como fallidas TODAS las que faltaban y
               cortaba. Con la ventana deslizante eso es mucho peor que antes:
               el firmado ahora dura lo que dura la subida entera, así que un
               `pm2 restart` de cuatro segundos en el minuto cuarenta habría
               matado las mil cuatrocientas que faltaban. */
            continue;
          }
          firmadas.forEach((p, k) => {
            const b = tanda[k];
            if (b) cola.push({ b, p });
          });
        }
      } finally {
        firmando = false;
      }
    }

    /** Una tanda, con reintentos. null si no se pudo y ya se marcaron fallidas. */
    async function firmarTanda(tanda: ItemSubida[]): Promise<Firmada[] | null> {
      for (let intento = 0; ; intento++) {
        try {
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
          if (res.ok) {
            const data = (await res.json()) as { items: Firmada[] };
            return data.items;
          }
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          const msg = data.error ?? "Error al iniciar la subida";
          // Un 4xx es cuota, tamaño o permisos: no mejora reintentando.
          if (res.status < 500 || intento >= REINTENTOS) {
            tanda.forEach((b) => uno(b.localId, { state: "failed", error: msg }));
            return null;
          }
        } catch (err) {
          if (intento >= REINTENTOS) {
            const msg = err instanceof Error ? err.message : "Red caída";
            tanda.forEach((b) => uno(b.localId, { state: "failed", error: msg }));
            return null;
          }
        }
        await new Promise((r) => setTimeout(r, ESPERA_BASE_MS * Math.pow(2, intento)));
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
        const { b } = cola[idx]!;
        // `p` cambia si hay que refirmar: la misma foto con otra autorización.
        let p = cola[idx]!.p;

        // Hasta tres intentos, esperando cada vez un poco más. Casi todo lo que
        // falla en una tanda grande es la conexión pestañeando, y volver a
        // intentar una vez arregla más que cualquier mensaje de error.
        let refirmas = 0;
        for (let intento = 0; ; intento++) {
          // El photoId se guarda en el item apenas se conoce: es lo que le
          // permite a "Reintentar" reusar la fila en vez de crear otra.
          b.photoId = p.photoId;
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
              alAvanzar: (n) => avance(b.localId, Math.min(99, n)),
            });

            /* El commit se reintenta APARTE de la subida.

               El archivo ya está en S3: lo único que falta es un POST de
               doscientos bytes. Antes compartía los tres intentos con el PUT, y
               como cada intento vuelve a subir el archivo entero, un `pm2
               restart` —que tarda más que los cinco segundos de esos tres
               intentos— hacía que los diez obreros en vuelo re-subieran 15 MB
               cada uno por un POST que habría andado esperando dos segundos
               más. */
            await commitConReintentos(p.photoId);
            terminadas.current.push(Date.now());
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

            /* Firma vencida: se pide otra para ESTA foto y no cuenta como
               intento. Es la misma fila y la misma clave en S3, así que no se
               crea nada nuevo — que es justo lo que llenó la base de filas
               huérfanas cuando el cliente caía al presign normal. */
            if (fallo.refirmar && refirmas < REFIRMAS_MAX) {
              const nueva = await refirmar(p.photoId, b.file.size);
              if (nueva === "ya") {
                // El archivo estaba arriba: lo que había fallado era el commit.
                uno(b.localId, { state: "complete", pct: 100 });
                break;
              }
              if (nueva) {
                p = { ...p, uploadUrl: nueva.uploadUrl, contentType: nueva.contentType };
                refirmas++;
                intento--;
                continue;
              }
            }

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

    /**
     * Otra URL para la misma foto. Nunca crea una fila nueva.
     *
     * Devuelve la firma, "ya" si el archivo estaba arriba, o null si no se
     * pudo. Todo el cuerpo va en try/catch: si esto tirara, la excepción
     * escaparía del catch del obrero —está adentro de uno— y mataría al obrero
     * en silencio, dejando el Promise.all colgado y la foto en "uploading"
     * para siempre.
     */
    async function refirmar(
      photoId: string,
      size: number,
    ): Promise<{ uploadUrl: string; contentType: string } | "ya" | null> {
      try {
        const r = await fetch(
          `/api/dashboard/events/${eventId}/photos/${photoId}/presign`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ size }),
            signal: AbortSignal.timeout(COMMIT_MS),
          },
        );
        if (!r.ok) return null;
        const d = (await r.json()) as {
          already?: boolean;
          uploadUrl?: string;
          contentType?: string;
        };
        if (d.already) return "ya";
        if (!d.uploadUrl) return null;
        return { uploadUrl: d.uploadUrl, contentType: d.contentType ?? "image/jpeg" };
      } catch {
        return null;
      }
    }

    /**
     * El commit, con sus propios reintentos y sin volver a subir nada.
     *
     * Es idempotente del lado del servidor —si la foto ya tenía tamaño contesta
     * "ya estaba"— así que insistir no duplica nada.
     */
    async function commitConReintentos(photoId: string): Promise<void> {
      for (let i = 0; ; i++) {
        try {
          const cm = await fetch(
            `/api/dashboard/events/${eventId}/photos/${photoId}/commit`,
            { method: "POST", signal: AbortSignal.timeout(COMMIT_MS) },
          );
          if (cm.ok) return;
          const data = (await cm.json().catch(() => ({}))) as { error?: string };
          const msg = data.error ?? `El servidor respondió ${cm.status}`;
          // El 410 dice que el archivo no está en S3: eso no lo arregla el
          // commit, hay que volver a subir.
          if (cm.status === 410) throw new FalloSubida("El archivo no llegó completo a S3", false);
          if (cm.status < 500 || i >= COMMIT_REINTENTOS - 1) {
            throw new FalloSubida(msg, cm.status >= 500);
          }
        } catch (e) {
          if (e instanceof FalloSubida) throw e;
          if (i >= COMMIT_REINTENTOS - 1) {
            throw new FalloSubida("No pudimos confirmar la subida", true);
          }
        }
        await new Promise((r) => setTimeout(r, COMMIT_ESPERAS_MS[i] ?? 30_000));
      }
    }

    // Se arrancan tantos obreros como fotos haya, con tope de MAX_PARALELO. No
    // se mira cola.length porque en este momento está vacía: se llena mientras
    // corren. Mirarla acá dejaría cero obreros y no subiría nada.
    await Promise.all(
      Array.from({ length: Math.min(MAX_PARALELO, aProcesar.length) }, () => obrero()),
    );
    // Sin obreros no queda quién vacíe la cola: si el firmado sigue esperando
    // lugar en la ventana, giraría para siempre.
    cortado = true;
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

  /**
   * La misma subida, sin red.
   *
   * Sube de a MAX_PARALELO como la de verdad y con porcentajes que avanzan, para
   * que en el video se vea el mismo comportamiento: varias fotos a la vez, la
   * barra general moviéndose, y el contador de "N de M" subiendo.
   */
  async function procesarFingido(aProcesar: ItemSubida[]) {
    let cursor = 0;
    async function obrero() {
      while (cursor < aProcesar.length) {
        const b = aProcesar[cursor++]!;
        uno(b.localId, { state: "uploading", pct: 0, intentos: 1 });
        for (let pct = 10; pct <= 99; pct += 15) {
          await new Promise((r) => setTimeout(r, 70));
          uno(b.localId, { pct });
        }
        await new Promise((r) => setTimeout(r, 90));
        uno(b.localId, { state: "complete", pct: 100 });
      }
    }
    await Promise.all(
      Array.from({ length: Math.min(MAX_PARALELO, aProcesar.length) }, () => obrero()),
    );
    // Sin router.refresh(): en la demo las fotos las revela el guion, no el
    // servidor, y refrescar tiraría abajo el estado de la pantalla.
  }

  return {
    items,
    total,
    hechas,
    fallidas,
    cerrado,
    fase,
    pct,
    /** Fotos por minuto, o null si todavía no hay muestra. */
    ritmoPorMin,
    /** Cuánto falta, en milisegundos. Null si no se puede estimar. */
    etaMs,
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
    /** La firma venció: hay que pedir otra para ESTA misma foto, no re-subirla. */
    readonly refirmar = false,
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
    let arranco = false;
    const rearmar = (ms: number, motivo: string) => {
      clearTimeout(reloj);
      reloj = setTimeout(() => {
        xhr.abort();
        reject(new FalloSubida(motivo, true));
      }, ms);
    };
    const parar = () => clearTimeout(reloj);

    xhr.upload.onprogress = (e) => {
      /* Dos fases, y la primera es la que faltaba.

         Mientras el XHR está encolado por el navegador —seis conexiones por
         host, diez obreros— no manda un solo byte y no es culpa de nadie. Recién
         cuando empieza a transmitir tiene sentido exigirle que avance. */
      if (!arranco && e.loaded > 0) arranco = true;
      rearmar(
        arranco ? SIN_AVANCE_MS : SIN_ARRANCAR_MS,
        arranco
          ? `Se quedó sin avanzar ${SIN_AVANCE_MS / 1000}s`
          : "No llegó a empezar a subir",
      );
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
      /* El 403 es la firma vencida, y tiene arreglo.

         Antes caía en la bolsa de "4xx = no se arregla" y mataba la foto en el
         acto, junto con todas las que venían atrás. Es exactamente el error que
         partía las tandas grandes. Ahora se pide otra URL para la MISMA foto y
         se sigue. */
      if (xhr.status === 403) {
        reject(new FalloSubida("La autorización para subir venció", true, true));
        return;
      }
      // 5xx y 429 son de S3 teniendo un mal momento y pasan solos. El resto de
      // los 4xx —tamaño mal firmado, argumento inválido— falla igual las tres
      // veces.
      const transitorio = xhr.status >= 500 || xhr.status === 429 || xhr.status === 0;
      reject(new FalloSubida(`S3 respondió ${xhr.status}`, transitorio));
    };
    xhr.open("PUT", opts.url);
    xhr.setRequestHeader("Content-Type", opts.contentType);
    rearmar(SIN_ARRANCAR_MS, "No llegó a empezar a subir");
    xhr.send(opts.file);
  });
}
