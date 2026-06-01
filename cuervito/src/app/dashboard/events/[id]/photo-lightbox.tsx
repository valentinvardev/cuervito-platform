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
  eventId,
  onClose,
  onDelete,
}: {
  photos: Tile[];
  startIndex: number;
  eventId: string;
  onClose: () => void;
  onDelete?: (photoId: string) => Promise<void> | void;
}) {
  const [idx, setIdx] = useState(startIndex);
  const [loaded, setLoaded] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const touchStartX = useRef<number | null>(null);

  async function downloadOriginal(photoId: string, filename: string) {
    setDownloading(true);
    setDownloadError(null);
    try {
      const res = await fetch(
        `/api/dashboard/events/${eventId}/photos/${photoId}/download`,
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "No pudimos generar la descarga.");
      }
      const data = (await res.json()) as { url: string; filename: string };
      const a = document.createElement("a");
      a.href = data.url;
      a.download = data.filename ?? filename;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : "Error de red.");
      setTimeout(() => setDownloadError(null), 3000);
    } finally {
      setDownloading(false);
    }
  }

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

      {current.bibNumbers && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            bottom: 96,
            left: "50%",
            transform: "translateX(-50%)",
            padding: "5px 12px",
            borderRadius: 999,
            background: "rgba(245,130,10,0.92)",
            color: "var(--text-on-accent)",
            fontFamily: "var(--font-mono)",
            fontWeight: 600,
            fontSize: 13,
            letterSpacing: "0.02em",
            boxShadow: "0 4px 14px rgba(0,0,0,0.4)",
            backdropFilter: "blur(4px)",
            pointerEvents: "none",
            zIndex: 1,
          }}
        >
          #{current.bibNumbers}
        </div>
      )}

      <div className="lb-meta" onClick={(e) => e.stopPropagation()}>
        <span>
          {idx + 1} / {total}
        </span>
        <span className="sep">·</span>
        <span className="filename" title={current.filename}>
          {current.filename}
        </span>
        <span className="sep">·</span>
        <button
          type="button"
          className="action"
          disabled={downloading}
          onClick={() => downloadOriginal(current.id, current.filename)}
          title="Descargar el original (sin marca de agua)"
        >
          <i className="ti ti-download" style={{ marginRight: 4 }} />
          {downloading ? "Preparando…" : "Descargar"}
        </button>
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

      {downloadError && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            padding: "10px 16px",
            background: "rgba(224,85,85,0.95)",
            color: "white",
            borderRadius: 8,
            fontSize: 13,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            zIndex: 1,
          }}
        >
          <i className="ti ti-alert-circle" />
          {downloadError}
        </div>
      )}
    </div>
  );

  // Render to <html> rather than <body> so a body-level `transform`
  // (e.g. panel-anim's page-fade-in) doesn't trap our `position: fixed`.
  return createPortal(content, document.documentElement);
}
