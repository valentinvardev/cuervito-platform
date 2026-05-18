"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Confirmation modal for destructive photo actions (single delete or bulk).
 * Shown instead of the browser's native `confirm()` — keeps the look on-brand
 * and gives us room for a longer warning + a styled trash icon. Portal'd to
 * documentElement so it always renders on top regardless of stacking context.
 */
export function DeletePhotosDialog({
  open,
  count,
  busy,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  count: number;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    confirmBtnRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onCancel();
      if (e.key === "Enter" && !busy) onConfirm();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, busy, onCancel, onConfirm]);

  if (!open || !mounted) return null;

  const plural = count !== 1;
  const title = plural
    ? `¿Eliminar ${count} fotos?`
    : "¿Eliminar esta foto?";

  return createPortal(
    <div
      className="cv-modal-backdrop open"
      onClick={(e) => {
        if (busy) return;
        if (e.target === e.currentTarget) onCancel();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="cv-modal-title"
    >
      <div className="cv-modal">
        <div className="cv-modal-icon">
          <i className="ti ti-trash" />
        </div>
        <h2 id="cv-modal-title">{title}</h2>
        <p>
          Esta acción no se puede deshacer. Si {plural ? "alguna" : "esta"}{" "}
          foto fue vendida, no la vamos a borrar.
        </p>

        <div className="cv-modal-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onCancel}
            disabled={busy}
          >
            Cancelar
          </button>
          <button
            type="button"
            ref={confirmBtnRef}
            className="btn btn-danger"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? (
              <>
                <span
                  style={{
                    width: 13,
                    height: 13,
                    border: "2px solid currentColor",
                    borderTopColor: "transparent",
                    borderRadius: "50%",
                    display: "inline-block",
                    animation: "spin 0.8s linear infinite",
                  }}
                />
                Eliminando…
              </>
            ) : (
              <>
                <i className="ti ti-trash" />
                {plural ? `Eliminar ${count}` : "Eliminar"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.documentElement,
  );
}
