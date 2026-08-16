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
 * Nota sobre el orden: primero se firma TODO y recién después se sube. Se
 * podría ir firmando y subiendo de a poco, pero la API firma de a 50 y arrancar
 * la cola antes de tener todas las URLs deja obreros sin trabajo esperando la
 * próxima tanda.
 */
export type ItemSubida = {
  localId: string;
  file: File;
  thumbDataUrl?: string;
  photoId?: string;
  state: "pending" | "uploading" | "complete" | "failed";
  pct: number;
  error?: string;
  /** Se dibuja como celda en la grilla; el resto cae en el "+X". */
  visible: boolean;
};

// S3 es otro host, así que los PUT no comparten el presupuesto de conexiones
// por origen del navegador con nuestras propias llamadas a la API.
const MAX_PARALELO = 10;
const MAX_CELDAS = 11; // la grilla muestra hasta 11 celdas + una de "+X"
const FIRMA_POR_TANDA = 50; // tope de la API por pedido

export const ACEPTADOS = "image/jpeg,image/png,image/webp";

export function useSubida(eventId: string) {
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
    const arr = todos.filter((f) => ACEPTADOS.split(",").includes(f.type));
    const afuera = todos.length - arr.length;
    if (arr.length === 0) return { entraron: 0, afuera };

    const nuevos: ItemSubida[] = await Promise.all(
      arr.map(async (file, idx) => ({
        localId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${idx}`,
        file,
        thumbDataUrl: await miniatura(file),
        state: "pending" as const,
        pct: 0,
        visible: items.length + idx < MAX_CELDAS,
      })),
    );

    setItems((prev) =>
      [...prev, ...nuevos].map((it, i) => ({ ...it, visible: i < MAX_CELDAS })),
    );

    void procesar(nuevos);
    return { entraron: arr.length, afuera };
  }

  async function procesar(aProcesar: ItemSubida[]) {
    const firmadas: Array<{ photoId: string; uploadUrl: string; contentType: string }> = [];
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
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          const msg = data.error ?? "Error al iniciar la subida";
          aProcesar.forEach((b) => uno(b.localId, { state: "failed", error: msg }));
          return;
        }
        const data = (await res.json()) as {
          items: Array<{ photoId: string; uploadUrl: string; contentType: string }>;
        };
        firmadas.push(...data.items);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Red caída";
      aProcesar.forEach((b) => uno(b.localId, { state: "failed", error: msg }));
      return;
    }

    // Cola de obreros: arrancan MAX_PARALELO y cada uno, al terminar, agarra el
    // siguiente. Una foto lenta no frena al resto, que es lo que importa cuando
    // la tanda mezcla archivos de 2 MB con otros de 20.
    const cola = aProcesar.map((b, i) => ({ b, p: firmadas[i]! }));
    let cursor = 0;
    async function obrero() {
      while (true) {
        const idx = cursor++;
        if (idx >= cola.length) return;
        const { b, p } = cola[idx]!;
        if (!p) {
          uno(b.localId, { state: "failed", error: "Sin URL" });
          continue;
        }
        uno(b.localId, { state: "uploading", photoId: p.photoId, pct: 0 });
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
            { method: "POST" },
          );
          if (!cm.ok) {
            const data = (await cm.json().catch(() => ({}))) as { error?: string };
            throw new Error(data.error ?? "Commit falló");
          }
          uno(b.localId, { state: "complete", pct: 100 });
        } catch (err) {
          uno(b.localId, {
            state: "failed",
            error: err instanceof Error ? err.message : "Error",
          });
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(MAX_PARALELO, cola.length) }, () => obrero()));

    // Vuelve a pedir la pantalla para que aparezcan las fotos recién subidas.
    router.refresh();
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
    limpiar: () => setItems([]),
  };
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
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) opts.alAvanzar(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.ontimeout = () => reject(new Error("Timeout"));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`S3 PUT failed (${xhr.status})`));
    };
    xhr.open("PUT", opts.url);
    xhr.setRequestHeader("Content-Type", opts.contentType);
    xhr.send(opts.file);
  });
}
