"use client";

import { useEffect, useState } from "react";

export function DeleteEventDialog({
  eventName,
  action,
}: {
  eventName: string;
  action: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(2);

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
        className="btn"
        style={{
          color: "var(--error)",
          border: "1px solid rgba(224,85,85,0.45)",
          background: "transparent",
        }}
        onClick={() => setOpen(true)}
      >
        Eliminar
      </button>

      {open && (
        <div
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
                <button
                  type="submit"
                  className="btn"
                  disabled={count > 0}
                  style={{
                    color: "var(--error)",
                    border: "1px solid rgba(224,85,85,0.45)",
                    background: count > 0 ? "transparent" : "rgba(224,85,85,0.08)",
                    opacity: count > 0 ? 0.55 : 1,
                  }}
                >
                  {count > 0 ? `Eliminar (${count})` : "Sí, eliminar"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
