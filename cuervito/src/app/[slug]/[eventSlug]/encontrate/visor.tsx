"use client";

import { Check, ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";

// fullUrl y no previewUrl: en la grilla previewUrl es la miniatura de 560px,
// que estirada a pantalla completa se ve borrosa. El visor es donde el atleta
// decide si compra, así que ahí va la de 2400.
type FotoVisor = { id: string; fullUrl: string; bibNumbers: string | null };

/** Lo que dura la animación de salida en el CSS. */
const SALIDA_MS = 150;

/**
 * La foto en grande, con el botón de comprar al lado.
 *
 * El botón de agregar va acá y no sólo en la grilla porque acá es donde se
 * decide: uno abre la foto justamente para mirarla de cerca antes de pagarla.
 * Obligar a cerrar y buscar el mismo cuadrado en la grilla para agregarla es
 * pedirle al atleta que recuerde cuál era.
 */
export function Visor({
  fotos,
  indice,
  enCarrito,
  precio,
  alCerrar,
  alIr,
  alAlternar,
}: {
  fotos: FotoVisor[];
  indice: number;
  enCarrito: (id: string) => boolean;
  precio: string;
  alCerrar: () => void;
  alIr: (i: number) => void;
  alAlternar: (f: FotoVisor) => void;
}) {
  const [cerrando, setCerrando] = useState(false);
  const foto = fotos[indice];

  function cerrar() {
    setCerrando(true);
    setTimeout(alCerrar, SALIDA_MS);
  }

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

  useEffect(() => {
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = antes;
    };
  }, []);

  if (!foto) return null;
  const puesta = enCarrito(foto.id);

  return (
    <div
      className="et-visor"
      data-cerrando={cerrando ? "1" : ""}
      role="dialog"
      aria-modal="true"
      aria-label="Foto"
      onClick={(e) => {
        if (e.target === e.currentTarget) cerrar();
      }}
    >
      <button className="et-visor-x" onClick={cerrar} aria-label="Cerrar">
        <X />
      </button>
      <button
        className="et-visor-nav izq"
        onClick={() => alIr(indice - 1)}
        disabled={indice === 0}
        aria-label="Anterior"
      >
        <ChevronLeft />
      </button>
      <button
        className="et-visor-nav der"
        onClick={() => alIr(indice + 1)}
        disabled={indice === fotos.length - 1}
        aria-label="Siguiente"
      >
        <ChevronRight />
      </button>

      <div className="et-visor-caja">
        <div className="et-visor-marco">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={foto.id}
            src={foto.fullUrl}
            alt={foto.bibNumbers ? `Dorsal ${foto.bibNumbers}` : "Foto del evento"}
          />
        </div>

        <div className="et-visor-pie">
          <div className="et-visor-datos">
            {foto.bibNumbers ? `Dorsal ${foto.bibNumbers.split(",")[0]}` : "Foto"}
            <span>
              {indice + 1} de {fotos.length} · {precio}
            </span>
          </div>

          <button
            className={`et-btn ${puesta ? "" : "et-btn-acento"}`}
            onClick={() => alAlternar(foto)}
          >
            {puesta ? (
              <>
                <Check /> En el carrito
              </>
            ) : (
              <>
                <Plus /> Agregar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
