"use client";

import { Check, ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import { useEffect, useState } from "react";

type Foto = { id: string; filename: string; bibNumbers: string | null; previewUrl: string };

/** Lo que dura la animación de salida en el CSS. */
const SALIDA_MS = 150;

/**
 * La foto comprada, en grande.
 *
 * Con el botón de descargar adentro: se abre la foto justamente para mirarla de
 * cerca antes de decidir cuál guardar, y obligar a cerrar y buscar el mismo
 * cuadrado en la grilla es pedirle al comprador que recuerde cuál era.
 *
 * Muestra la versión limpia, la misma que la grilla: el comprador ya pagó y no
 * tiene por qué ver su propia compra con marca de agua.
 */
export function Visor({
  fotos,
  indice,
  descargadas,
  alCerrar,
  alIr,
  alDescargar,
}: {
  fotos: Foto[];
  indice: number;
  descargadas: Set<string>;
  alCerrar: () => void;
  alIr: (i: number) => void;
  alDescargar: (f: Foto) => void | Promise<void>;
}) {
  const [cerrando, setCerrando] = useState(false);
  const [bajando, setBajando] = useState(false);
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
  const lista = descargadas.has(foto.id);

  return (
    <div
      className="et-visor"
      data-cerrando={cerrando ? "1" : ""}
      role="dialog"
      aria-modal="true"
      aria-label="Tu foto"
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
          <img key={foto.id} src={foto.previewUrl} alt={foto.filename} />
        </div>

        <div className="et-visor-pie">
          <div className="et-visor-datos">
            {foto.bibNumbers ? `Dorsal ${foto.bibNumbers.split(",")[0]}` : "Tu foto"}
            <span>
              {indice + 1} de {fotos.length}
            </span>
          </div>

          <button
            className={`et-btn ${lista ? "" : "et-btn-acento"}`}
            disabled={bajando}
            onClick={() => {
              setBajando(true);
              void Promise.resolve(alDescargar(foto)).finally(() => setBajando(false));
            }}
          >
            {lista ? <Check /> : <Download />}
            {bajando ? "Descargando" : lista ? "Descargada" : "Descargar"}
          </button>
        </div>
      </div>
    </div>
  );
}
