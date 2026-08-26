"use client";

import { useEffect } from "react";

import { EventCoverageShell } from "./event-coverage-shell";
import { EventFeedShell } from "./event-feed-shell";
import { useFotos, type Foto } from "./usar-fotos";

/**
 * Las plantillas viejas, sin esperar a que estén todas las fotos.
 *
 * El problema: la página tardaba 13 segundos porque el servidor no devolvía
 * NADA hasta tener las 2.162 fotos del evento. Trece segundos mirando el
 * blanco antes de poder siquiera leer el nombre del evento.
 *
 * Estas dos plantillas filtran del lado del navegador —el dorsal se busca
 * sobre el arreglo que tienen en memoria— así que no se pueden paginar de
 * verdad sin reescribirles el filtrado, que son mil quinientas líneas entre
 * las dos. Pero sí se puede dejar de ESPERARLAS:
 *
 *   · El servidor manda las primeras 60 y contesta. La página abre en menos
 *     de un segundo, con el buscador y la primera pantalla de fotos.
 *   · Las demás llegan solas por detrás, en tandas de 300, sin que nadie
 *     apriete nada. La grilla crece mientras el atleta ya está mirando.
 *
 * El único costo es que buscar un dorsal en los primeros segundos busca sobre
 * lo que llegó hasta ese momento. Es un intercambio claramente bueno: antes
 * no se podía buscar nada durante trece segundos.
 *
 * La plantilla de encontrate no pasa por acá: ésa busca en el servidor, así
 * que no necesita tener las fotos en memoria y pagina de verdad.
 */

/** Tandas grandes para el relleno: ya hay algo en pantalla y lo caro son los
 *  viajes, no los bytes. 2.162 fotos son ocho pedidos en vez de treinta y seis. */
const TANDA_FONDO = 300;

export function GaleriaProgresiva({
  layout,
  cursorInicial,
  ...props
}: {
  layout: "coverage" | "feed";
  cursorInicial: string | null;
  photographer: React.ComponentProps<typeof EventCoverageShell>["photographer"];
  event: React.ComponentProps<typeof EventCoverageShell>["event"];
  photos: Foto[];
  discounts?: React.ComponentProps<typeof EventCoverageShell>["discounts"];
  testMode?: boolean;
}) {
  const { fotos, hayMas, trayendoMas, cargarMas } = useFotos({
    eventId: props.event.id,
    iniciales: props.photos,
    cursorInicial,
    modo: { tipo: "todas" },
    tanda: TANDA_FONDO,
  });

  // Se encadena solo: cada tanda que llega dispara la siguiente. No hace falta
  // un bucle ni un temporizador —alcanza con reaccionar a que sigue habiendo—,
  // y como cargarMas se protege de reentrar, dos disparos no piden dos veces.
  useEffect(() => {
    if (hayMas && !trayendoMas) cargarMas();
  }, [hayMas, trayendoMas, cargarMas]);

  const shellProps = { ...props, photos: fotos };

  return layout === "feed" ? (
    <EventFeedShell {...shellProps} />
  ) : (
    <EventCoverageShell {...shellProps} />
  );
}
