"use client";

import { ChevronLeft, ChevronRight, Download, ScanFace, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";

type FotoVisor = {
  id: string;
  url: string | null;
  bib: string | null;
  caras: number;
  ventas: number;
};

/** Lo que dura la animación de salida en el CSS. */
const SALIDA_MS = 160;

/**
 * Ver una foto grande.
 *
 * Tocar una foto la abre acá y no la selecciona. Mirar es lo que uno hace todo
 * el tiempo en esta pantalla —revisar que la tanda salió bien, buscar un
 * dorsal—; seleccionar es lo que hace de vez en cuando para borrar un lote. El
 * gesto barato tiene que hacer lo frecuente.
 *
 * Se desmonta con animación de salida: el componente sigue montado los 160 ms
 * que dura, porque si se saca del DOM de una la animación no llega a correr y
 * la foto desaparece de golpe.
 */
export function Visor({
  fotos,
  indice,
  eventId,
  alCerrar,
  alIr,
  alBorrar,
}: {
  fotos: FotoVisor[];
  indice: number;
  eventId: string;
  alCerrar: () => void;
  alIr: (i: number) => void;
  alBorrar: (id: string) => void;
}) {
  const [cerrando, setCerrando] = useState(false);
  const [bajando, setBajando] = useState(false);
  const foto = fotos[indice];

  function cerrar() {
    setCerrando(true);
    setTimeout(alCerrar, SALIDA_MS);
  }

  // Flechas para moverse y Escape para salir. En una pantalla donde se revisan
  // cuatrocientas fotos, tener que ir al mouse para pasar a la siguiente es la
  // diferencia entre revisarlas y no revisarlas.
  useEffect(() => {
    const alTecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrar();
      else if (e.key === "ArrowLeft" && indice > 0) alIr(indice - 1);
      else if (e.key === "ArrowRight" && indice < fotos.length - 1) alIr(indice + 1);
    };
    window.addEventListener("keydown", alTecla);
    return () => window.removeEventListener("keydown", alTecla);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indice, fotos.length]);

  // El fondo de la página no se scrollea mientras el visor está abierto.
  useEffect(() => {
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = antes;
    };
  }, []);

  async function bajar() {
    if (!foto) return;
    setBajando(true);
    try {
      // El endpoint devuelve una URL firmada del original sin marca de agua, y
      // se abre en una pestaña. Bajarlo con fetch + blob obligaría a traer los
      // 20 MB al navegador para después escribirlos: así lo hace el sistema.
      const r = await fetch(`/api/dashboard/events/${eventId}/photos/${foto.id}/download`);
      const d = (await r.json()) as { url?: string; error?: string };
      if (d.url) window.open(d.url, "_blank", "noopener");
    } catch {
      // Sin ruido: el botón vuelve a estar disponible y se puede reintentar.
    } finally {
      setBajando(false);
    }
  }

  if (!foto) return null;

  return (
    <div
      className="visor"
      data-cerrando={cerrando ? "1" : ""}
      role="dialog"
      aria-modal="true"
      aria-label="Foto"
      onClick={(e) => {
        // Sólo el fondo cierra. Un click en la foto o en un botón no.
        if (e.target === e.currentTarget) cerrar();
      }}
    >
      <div className="visor-marco">
        <button className="visor-x" onClick={cerrar} aria-label="Cerrar">
          <X />
        </button>

        <button
          className="visor-nav izq"
          onClick={() => alIr(indice - 1)}
          disabled={indice === 0}
          aria-label="Anterior"
        >
          <ChevronLeft />
        </button>

        {foto.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={foto.id} src={foto.url} alt={foto.bib ? `Dorsal ${foto.bib}` : "Foto"} />
        ) : (
          <span style={{ color: "rgba(255,255,255,.6)" }}>Esta foto ya no está disponible.</span>
        )}

        <button
          className="visor-nav der"
          onClick={() => alIr(indice + 1)}
          disabled={indice === fotos.length - 1}
          aria-label="Siguiente"
        >
          <ChevronRight />
        </button>
      </div>

      <div className="visor-pie">
        <div className="visor-datos">
          <b>
            {foto.bib ? `Dorsal ${foto.bib.split(",")[0]}` : "Sin dorsal"}
            {" · "}
            {indice + 1} de {fotos.length}
          </b>
          <span>
            <ScanFace
              style={{ width: 12, height: 12, verticalAlign: -1, marginRight: 4 }}
            />
            {foto.caras} {foto.caras === 1 ? "cara" : "caras"}
            {foto.ventas > 0 && ` · vendida ${foto.ventas} ${foto.ventas === 1 ? "vez" : "veces"}`}
          </span>
        </div>

        <button className="btn btn-sm" onClick={bajar} disabled={bajando}>
          <Download /> {bajando ? "Preparando" : "Descargar"}
        </button>
        <button
          className="btn btn-sm peligro"
          onClick={() => {
            alBorrar(foto.id);
            cerrar();
          }}
        >
          <Trash2 /> Eliminar
        </button>
      </div>
    </div>
  );
}
