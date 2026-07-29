"use client";

import { useEffect, useState } from "react";
import { createPortal, useFormStatus } from "react-dom";

export function DeleteEventDialog({
  eventName,
  action,
}: {
  eventName: string;
  action: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(2);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setCount(2);
    const id = setInterval(() => {
      setCount((c) => (c > 0 ? c - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="btn btn-danger-solid"
        data-tip="Borra el evento, sus fotos de S3 y su colección de reconocimiento"
        onClick={() => setOpen(true)}
      >
        <i className="ti ti-trash" />
        Eliminar
      </button>

      {open && mounted && createPortal(
        <div
          className="cs-modal-backdrop"
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(8, 6, 5, 0.72)",
            backdropFilter: "blur(8px)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <div
            className="cs-modal-panel"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              borderRadius: 16,
              width: "100%",
              maxWidth: 460,
              padding: 26,
              boxShadow: "0 20px 60px rgba(0,0,0,0.55)",
            }}
          >
            <h3
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: 19,
                letterSpacing: "-0.02em",
                marginBottom: 8,
              }}
            >
              ¿Eliminar este evento?
            </h3>
            <p style={{ color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.55, marginBottom: 22 }}>
              Vas a borrar <strong style={{ color: "var(--text-primary)" }}>{eventName}</strong> y
              todas sus fotos. Esta acción no se puede deshacer.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setOpen(false)}
              >
                Cancelar
              </button>
              <form action={action}>
                <ConfirmButton count={count} />
              </form>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

function ConfirmButton({ count }: { count: number }) {
  const { pending } = useFormStatus();
  const locked = count > 0 || pending;
  return (
    <button
      type="submit"
      className="btn btn-danger-solid"
      disabled={locked}
      style={{
        opacity: locked ? 0.55 : 1,
        minWidth: 128,
        justifyContent: "center",
      }}
    >
      {pending ? (
        <>
          <span className="del-spinner" aria-hidden />
          Eliminando…
        </>
      ) : count > 0 ? (
        `Eliminar (${count})`
      ) : (
        "Sí, eliminar"
      )}
      <style>{`
        .del-spinner {
          width: 14px;
          height: 14px;
          border: 2px solid rgba(255,255,255,0.4);
          border-top-color: #fff;
          border-radius: 50%;
          animation: del-spin 0.7s linear infinite;
        }
        @keyframes del-spin { to { transform: rotate(360deg); } }
      `}</style>
    </button>
  );
}
