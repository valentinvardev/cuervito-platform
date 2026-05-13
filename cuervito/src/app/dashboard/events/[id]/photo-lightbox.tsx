"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Tile = {
  id: string;
  filename: string;
  previewUrl: string;
  bibNumbers: string | null;
};

export function PhotoLightbox({
  photos,
  startIndex,
  onClose,
  onDelete,
}: {
  photos: Tile[];
  startIndex: number;
  onClose: () => void;
  onDelete?: (photoId: string) => Promise<void> | void;
}) {
  const [idx, setIdx] = useState(startIndex);
  const [loaded, setLoaded] = useState(false);
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

  // If the list shrinks (delete), keep index valid.
  useEffect(() => {
    if (idx >= total) {
      if (total === 0) onClose();
      else setIdx(total - 1);
    }
  }, [idx, total, onClose]);

  // Keyboard nav.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [next, prev, onClose]);

  // Lock body scroll.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  // Preload neighbours.
  useEffect(() => {
    const targets = [photos[idx - 1], photos[idx + 1]].filter(Boolean) as Tile[];
    targets.forEach((t) => {
      const img = new Image();
      img.src = t.previewUrl;
    });
  }, [idx, photos]);

  // Render into document.body to escape any ancestor with `transform` /
  // `filter` / `will-change` that would otherwise scope `position: fixed`.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!current) return null;
  if (!mounted) return null;

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
      role="dialog"
      aria-modal="true"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="lb-img"
        src={current.previewUrl}
        alt={current.filename}
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
        aria-label="Foto anterior"
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
        aria-label="Foto siguiente"
      >
        <i className="ti ti-chevron-right" />
      </button>

      <div className="lb-meta" onClick={(e) => e.stopPropagation()}>
        <span>
          {idx + 1} / {total}
        </span>
        <span className="sep">·</span>
        <span className="filename" title={current.filename}>
          {current.filename}
        </span>
        {current.bibNumbers && (
          <>
            <span className="sep">·</span>
            <span className="bib">#{current.bibNumbers}</span>
          </>
        )}
        {onDelete && (
          <>
            <span className="sep">·</span>
            <button
              type="button"
              className="action"
              onClick={async () => {
                if (!confirm("¿Eliminar esta foto?")) return;
                await onDelete(current.id);
              }}
            >
              Eliminar
            </button>
          </>
        )}
      </div>
    </div>
  );

  // Render to <html> rather than <body> so a body-level `transform`
  // (e.g. panel-anim's page-fade-in) doesn't trap our `position: fixed`.
  return createPortal(content, document.documentElement);
}
