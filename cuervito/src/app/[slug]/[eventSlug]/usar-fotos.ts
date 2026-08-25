"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Las fotos que la grilla está mostrando, y de dónde salen.
 *
 * Antes esto no existía porque no hacía falta: la página mandaba las 2.162
 * fotos del evento y filtrar era un `.filter()` sobre un arreglo que ya estaba
 * en memoria. Medido contra producción, traer esas 2.162 filas tardaba TREINTA
 * SEGUNDOS —no por Postgres, que las resuelve en 3 milisegundos, sino por las
 * 783 KB cruzando desde Supabase hasta el VPS—. Así que ahora viene una tanda
 * y el resto se pide.
 *
 * Eso mueve las dos búsquedas al servidor, y de ahí sale la forma de esto: hay
 * TRES maneras de llenar la grilla y son excluyentes entre sí.
 *
 *   todas   la tanda que vino con la página, más las que se vayan pidiendo
 *   dorsal  las que tienen ese número, filtradas en la base
 *   ids     una lista puntual — es lo que devuelve la búsqueda por selfie
 *
 * Volver a "todas" no vuelve a pedir nada: se restaura la primera tanda que ya
 * había llegado con el HTML. Limpiar una búsqueda tiene que ser instantáneo,
 * es deshacer.
 */

export type Foto = {
  id: string;
  previewUrl: string;
  bibNumbers: string | null;
  width: number | null;
  height: number | null;
};

export type Modo =
  | { tipo: "todas" }
  | { tipo: "dorsal"; q: string }
  | { tipo: "ids"; ids: string[] };

export type EstadoFotos = {
  fotos: Foto[];
  /** Hay más para pedir. */
  hayMas: boolean;
  /** Trayendo la primera tanda de una búsqueda. La grilla se vacía. */
  buscando: boolean;
  /** Trayendo una tanda más. La grilla se queda y crece abajo. */
  trayendoMas: boolean;
  fallo: boolean;
  cargarMas: () => void;
};

function clave(m: Modo): string {
  if (m.tipo === "dorsal") return `d:${m.q}`;
  if (m.tipo === "ids") return `i:${m.ids.join(",")}`;
  return "todas";
}

export function useFotos({
  eventId,
  iniciales,
  cursorInicial,
  modo,
}: {
  eventId: string;
  /** La primera tanda, que viaja con el HTML. */
  iniciales: Foto[];
  cursorInicial: string | null;
  modo: Modo;
}): EstadoFotos {
  const k = clave(modo);

  const [fotos, setFotos] = useState<Foto[]>(iniciales);
  const [cursor, setCursor] = useState<string | null>(cursorInicial);
  const [buscando, setBuscando] = useState(false);
  const [trayendoMas, setTrayendoMas] = useState(false);
  const [fallo, setFallo] = useState(false);

  // Para descartar respuestas viejas: tipear rápido puede hacer que la de "12"
  // llegue después de la de "123" y pise el resultado que se está mirando.
  const turno = useRef(0);
  // El modo vigente, para que cargarMas pida la página siguiente DE ESTA
  // búsqueda y no de la lista completa.
  const modoRef = useRef(modo);
  modoRef.current = modo;

  const url = useCallback(
    (m: Modo, desde?: string | null) => {
      const u = new URLSearchParams();
      if (m.tipo === "dorsal") u.set("dorsal", m.q);
      if (m.tipo === "ids") u.set("ids", m.ids.join(","));
      if (desde) u.set("cursor", desde);
      return `/api/evento/${eventId}/fotos?${u.toString()}`;
    },
    [eventId],
  );

  useEffect(() => {
    setFallo(false);

    if (k === "todas") {
      // Deshacer una búsqueda no cuesta un viaje: la primera tanda ya está.
      turno.current++;
      setFotos(iniciales);
      setCursor(cursorInicial);
      setBuscando(false);
      return;
    }

    const mio = ++turno.current;
    setBuscando(true);

    void (async () => {
      try {
        const r = await fetch(url(modoRef.current));
        if (turno.current !== mio) return;
        if (!r.ok) {
          setFallo(true);
          setFotos([]);
          setCursor(null);
          return;
        }
        const d = (await r.json()) as { fotos: Foto[]; cursor: string | null };
        if (turno.current !== mio) return;
        setFotos(d.fotos);
        setCursor(d.cursor);
      } catch {
        if (turno.current === mio) {
          setFallo(true);
          setFotos([]);
          setCursor(null);
        }
      } finally {
        if (turno.current === mio) setBuscando(false);
      }
    })();
    // iniciales y cursorInicial no entran: vienen del servidor y no cambian
    // dentro de una misma página.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k, url]);

  const cargarMas = useCallback(() => {
    if (!cursor || trayendoMas || buscando) return;
    const mio = turno.current;
    setTrayendoMas(true);

    void (async () => {
      try {
        const r = await fetch(url(modoRef.current, cursor));
        if (turno.current !== mio || !r.ok) return;
        const d = (await r.json()) as { fotos: Foto[]; cursor: string | null };
        if (turno.current !== mio) return;
        // Se concatena por id y no a ciegas: si dos pedidos se cruzan, una foto
        // repetida en la grilla se ve como un error de la galería.
        setFotos((prev) => {
          const vistas = new Set(prev.map((f) => f.id));
          return [...prev, ...d.fotos.filter((f) => !vistas.has(f.id))];
        });
        setCursor(d.cursor);
      } catch {
        // Sin red no se agrega nada y el botón sigue ahí para reintentar.
      } finally {
        if (turno.current === mio) setTrayendoMas(false);
      }
    })();
  }, [cursor, trayendoMas, buscando, url]);

  return { fotos, hayMas: !!cursor, buscando, trayendoMas, fallo, cargarMas };
}
