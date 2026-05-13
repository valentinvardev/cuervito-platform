"use client";

import { useEffect, useState } from "react";

export function SuspendDialog({
  userId,
  userName,
  action,
}: {
  userId: string;
  userName: string;
  action: (fd: FormData) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

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
        Suspender
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
          <form
            onClick={(e) => e.stopPropagation()}
            action={action}
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              borderRadius: 16,
              width: "100%",
              maxWidth: 480,
              padding: 26,
              boxShadow: "0 20px 60px rgba(0,0,0,0.55)",
            }}
          >
            <input type="hidden" name="userId" value={userId} />
            <h3
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: 19,
                letterSpacing: "-0.02em",
                marginBottom: 8,
              }}
            >
              Suspender a {userName}
            </h3>
            <p style={{ color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.55, marginBottom: 18 }}>
              No va a poder iniciar sesión hasta que reactivés la cuenta.
              Las fotos y ventas se conservan.
            </p>

            <div className="field" style={{ marginBottom: 22 }}>
              <label className="label">Motivo (opcional)</label>
              <textarea
                name="reason"
                className="input"
                placeholder="Razón interna para la suspensión…"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                maxLength={500}
              />
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-outline" onClick={() => setOpen(false)}>
                Cancelar
              </button>
              <button
                type="submit"
                className="btn"
                style={{
                  color: "var(--error)",
                  border: "1px solid rgba(224,85,85,0.45)",
                  background: "rgba(224,85,85,0.08)",
                }}
              >
                Suspender
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
