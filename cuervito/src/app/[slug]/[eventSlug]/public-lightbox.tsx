"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useCart } from "./cart-context";

type Photo = {
  id: string;
  previewUrl: string;
  bibNumbers: string | null;
};

export function PublicLightbox({
  photos,
  startIndex,
  pricePerPhoto,
  onClose,
}: {
  photos: Photo[];
  startIndex: number;
  pricePerPhoto: number;
  onClose: () => void;
}) {
  const { isInCart, add, remove } = useCart();
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

  useEffect(() => {
    const targets = [photos[idx - 1], photos[idx + 1]].filter(Boolean) as Photo[];
    targets.forEach((t) => {
      const img = new Image();
      img.src = t.previewUrl;
    });
  }, [idx, photos]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!current) return null;
  if (!mounted) return null;
  const inCart = isInCart(current.id);

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

      {current.bibNumbers && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            bottom: 76,
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

      <div className="lb-meta" onClick={(e) => e.stopPropagation()} style={{ gap: 14 }}>
        <span>
          {idx + 1} / {total}
        </span>
        <span className="sep">·</span>
        <span style={{ color: "var(--accent)" }}>
          ${pricePerPhoto.toLocaleString("es-AR")}
        </span>
        <button
          type="button"
          style={{
            marginLeft: 6,
            padding: "5px 12px",
            borderRadius: 999,
            background: inCart ? "var(--success)" : "var(--accent)",
            color: inCart ? "white" : "var(--text-on-accent)",
            border: "none",
            fontFamily: "var(--font-ui)",
            fontWeight: 600,
            fontSize: 12,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
          onClick={() => {
            if (inCart) remove(current.id);
            else
              add({
                photoId: current.id,
                previewUrl: current.previewUrl,
                priceCents: Math.round(pricePerPhoto * 100),
              });
          }}
        >
          <i className={`ti ${inCart ? "ti-check" : "ti-plus"}`} />
          {inCart ? "En carrito" : "Agregar"}
        </button>
      </div>
    </div>
  );

  return createPortal(content, document.documentElement);
}
