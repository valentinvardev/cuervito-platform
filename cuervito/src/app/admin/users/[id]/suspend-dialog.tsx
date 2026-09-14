"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Suspender una cuenta, con motivo.
 *
 * Es un diálogo y no un botón directo porque no se deshace con un click: la
 * persona deja de poder entrar hasta que alguien la reactive, y el motivo
 * queda en la ficha para quien la mire después.
 */
export function SuspendDialog({
  userId,
  userName,
  action,
}: {
  userId: string;
  userName: string;
  action: (fd: FormData) => Promise<void>;
}) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");

  useEffect(() => {
    if (!abierto) return;
    document.documentElement.dataset.modal = "open";
    const alTecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
    };
    window.addEventListener("keydown", alTecla);
    return () => {
      window.removeEventListener("keydown", alTecla);
      document.documentElement.dataset.modal = "";
    };
  }, [abierto]);

  return (
    <>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        style={{ color: "var(--bad-txt)" }}
        onClick={() => setAbierto(true)}
      >
        Suspender
      </button>

      {abierto && (
        <div
          className="modal"
          role="dialog"
          aria-modal="true"
          aria-label={`Suspender a ${userName}`}
          onClick={(e) => {
            if (e.target === e.currentTarget) setAbierto(false);
          }}
        >
          <form action={action} className="modal-caja" style={{ maxWidth: 460 }}>
            <input type="hidden" name="userId" value={userId} />
            <div className="modal-h">
              <div>
                <h2>Suspender a {userName}</h2>
                <div className="sub">
                  No va a poder iniciar sesión hasta que alguien reactive la cuenta. Las fotos y las ventas
                  se conservan.
                </div>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                onClick={() => setAbierto(false)}
                aria-label="Cerrar"
              >
                <X />
              </button>
            </div>
            <div className="modal-b">
              <div className="ma-campo" style={{ marginTop: 0 }}>
                <label htmlFor="susp-motivo">Motivo (opcional, queda en la ficha)</label>
                <textarea
                  id="susp-motivo"
                  name="reason"
                  className="inp ta"
                  placeholder="Por qué se suspende…"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  rows={3}
                  maxLength={500}
                />
              </div>
            </div>
            <div className="modal-f">
              <button type="button" className="btn btn-ghost" onClick={() => setAbierto(false)}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-pri" style={{ background: "var(--bad)", color: "#fff" }}>
                Suspender
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
