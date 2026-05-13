"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Photo = {
  id: string;
  filename: string;
  bibNumbers: string | null;
  previewUrl: string;
};

/**
 * Lightbox for /descarga — reuses the same .lb/.lb-img/.lb-close/.lb-nav
 * classes as the public storefront lightbox (lightbox.css). Differs only
 * in the footer: a "Guardar foto" button instead of cart add/remove.
 */
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

  // Preload neighbors for snappy swipe
  useEffect(() => {
    [photos[idx - 1], photos[idx + 1]].forEach((p) => {
      if (p) {
        const img = new Image();
        img.src = p.previewUrl;
      }
    });
  }, [idx, photos]);

  if (!current || !mounted) return null;

  const saved = isSaved(current.id);
  const pending = isPending(current.id);

  const content = (
    <div
      className="lb open"
      onClick={onClose}
      onTouchStart={(e) => {
        touchStartX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const start = touchStartX.current;
        const end = e.changedTouches[0]?.clientX;
        touchStartX.current = null;
        if (start == null || end == null) return;
        const dx = end - start;
        if (Math.abs(dx) < 50) return;
        if (dx < 0) next();
        else prev();
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="lb-img"
        src={current.previewUrl}
        alt=""
        onClick={(e) => e.stopPropagation()}
        onLoad={() => setLoaded(true)}
      />

      {!loaded && (
        <div className="lb-loading">
          <span className="up-spinner" />
        </div>
      )}

      <button
        type="button"
        className="lb-close"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="Cerrar"
      >
        <i className="ti ti-x" />
      </button>

      <button
        type="button"
        className="lb-nav prev"
        onClick={(e) => {
          e.stopPropagation();
          prev();
        }}
        disabled={idx === 0}
        aria-label="Anterior"
      >
        <i className="ti ti-chevron-left" />
      </button>
      <button
        type="button"
        className="lb-nav next"
        onClick={(e) => {
          e.stopPropagation();
          next();
        }}
        disabled={idx === total - 1}
        aria-label="Siguiente"
      >
        <i className="ti ti-chevron-right" />
      </button>

      <div className="lb-meta" onClick={(e) => e.stopPropagation()} style={{ gap: 14 }}>
        <span>
          {idx + 1} / {total}
        </span>
        {current.bibNumbers && (
          <>
            <span className="sep">·</span>
            <span className="bib">#{current.bibNumbers}</span>
          </>
        )}
        <button
          type="button"
          onClick={() => onSave(current)}
          disabled={pending}
          style={{
            marginLeft: 6,
            padding: "6px 14px",
            borderRadius: 999,
            background: saved ? "var(--success)" : "var(--accent)",
            color: saved ? "white" : "var(--text-on-accent)",
            border: "none",
            fontFamily: "var(--font-ui)",
            fontWeight: 600,
            fontSize: 12,
            cursor: pending ? "wait" : "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          {pending ? (
            <>
              <span
                style={{
                  width: 11,
                  height: 11,
                  border: "2px solid currentColor",
                  borderTopColor: "transparent",
                  borderRadius: "50%",
                  display: "inline-block",
                  animation: "spin 0.8s linear infinite",
                }}
              />
              Preparando
            </>
          ) : saved ? (
            <>
              <i className="ti ti-check" />
              Guardada
            </>
          ) : (
            <>
              <i className="ti ti-download" />
              Guardar
            </>
          )}
        </button>
      </div>
    </div>
  );

  return createPortal(content, document.documentElement);
}
