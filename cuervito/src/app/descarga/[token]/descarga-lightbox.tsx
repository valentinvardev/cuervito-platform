"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Photo = {
  id: string;
  filename: string;
  bibNumbers: string | null;
  previewUrl: string;
};

export function DescargaLightbox({
  photos,
  startIndex,
  isSaved,
  isPending,
  onSave,
  onClose,
}: {
  photos: Photo[];
  startIndex: number;
  isSaved: (id: string) => boolean;
  isPending: (id: string) => boolean;
  onSave: (photo: Photo) => void;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(startIndex);
  const [loaded, setLoaded] = useState(false);
  const [mounted, setMounted] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const total = photos.length;
  const current = photos[idx];

  const next = useCallback(() => {
    setLoaded(false);
    setIdx((i) => Math.min(i + 1, total - 1));
  }, [total]);
  const prev = useCallback(() => {
    setLoaded(false);
    setIdx((i) => Math.max(i - 1, 0));
  }, []);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [next, prev, onClose]);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current == null) return;
    const endX = e.changedTouches[0]?.clientX ?? touchStartX.current;
    const dx = endX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < 50) return;
    if (dx < 0) next();
    else prev();
  }

  if (!current || !mounted) return null;

  const saved = isSaved(current.id);
  const pending = isPending(current.id);

  const content = (
    <div className="lb-root" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <button className="lb-close" onClick={onClose} aria-label="Cerrar">
        <i className="ti ti-x" />
      </button>

      <div className="lb-counter">
        {idx + 1} / {total}
      </div>

      {idx > 0 && (
        <button className="lb-chev lb-chev-left" onClick={prev} aria-label="Anterior">
          <i className="ti ti-chevron-left" />
        </button>
      )}
      {idx < total - 1 && (
        <button className="lb-chev lb-chev-right" onClick={next} aria-label="Siguiente">
          <i className="ti ti-chevron-right" />
        </button>
      )}

      <div className="lb-stage">
        {!loaded && <div className="lb-spinner" aria-hidden="true" />}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={current.previewUrl}
          alt={current.bibNumbers ?? "Foto"}
          className={`lb-img ${loaded ? "ready" : ""}`}
          onLoad={() => setLoaded(true)}
        />
      </div>

      <div className="lb-foot">
        {current.bibNumbers && (
          <div className="lb-bib">#{current.bibNumbers}</div>
        )}
        <button
          type="button"
          className="lb-save-btn"
          onClick={() => onSave(current)}
          disabled={pending}
        >
          {pending ? (
            <>
              <span className="spinner-mini" />
              Preparando…
            </>
          ) : saved ? (
            <>
              <i className="ti ti-check" />
              Guardada
            </>
          ) : (
            <>
              <i className="ti ti-download" />
              Guardar foto
            </>
          )}
        </button>
      </div>
    </div>
  );

  return createPortal(content, document.documentElement);
}
