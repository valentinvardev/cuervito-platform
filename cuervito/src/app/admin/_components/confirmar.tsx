"use client";

import { X } from "lucide-react";
import { useEffect } from "react";

/**
 * "¿Seguro?", con el vocabulario del panel.
 *
 * Para lo que cuesta deshacer: regenerar catorce mil vistas previas, quitar
 * la marca de un fotógrafo, suspender una cuenta. Misma mecánica que el resto
 * de los diálogos: tapa lo de atrás, se cierra con Escape y clickeando afuera.
 */
export function Confirmar({
  titulo,
  cuerpo,
  accion = "Confirmar",
  peligro = false,
  ocupado = false,
  alConfirmar,
  alCerrar,
}: {
  titulo: string;
  cuerpo: React.ReactNode;
  accion?: string;
  peligro?: boolean;
  ocupado?: boolean;
  alConfirmar: () => void;
  alCerrar: () => void;
}) {
  useEffect(() => {
    document.documentElement.dataset.modal = "open";
    const alTecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") alCerrar();
    };
    window.addEventListener("keydown", alTecla);
    return () => {
      window.removeEventListener("keydown", alTecla);
      document.documentElement.dataset.modal = "";
    };
  }, [alCerrar]);

  return (
    <div
      className="modal"
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
      onClick={(e) => {
        if (e.target === e.currentTarget) alCerrar();
      }}
    >
      <div className="modal-caja" style={{ maxWidth: 440 }}>
        <div className="modal-h">
          <div>
            <h2>{titulo}</h2>
            <div className="sub">{cuerpo}</div>
          </div>
          <button type="button" className="btn btn-ghost btn-icon" onClick={alCerrar} aria-label="Cerrar">
            <X />
          </button>
        </div>
        <div className="modal-f">
          <button type="button" className="btn btn-ghost" onClick={alCerrar} disabled={ocupado}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-pri"
            onClick={alConfirmar}
            disabled={ocupado}
            style={peligro ? { background: "var(--bad)", color: "#fff" } : undefined}
          >
            {ocupado ? "Un momento…" : accion}
          </button>
        </div>
      </div>
    </div>
  );
}
