"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { PhotoLightbox } from "./photo-lightbox";

type PhotoTile = {
  id: string;
  filename: string;
  fileSize: number | null;
  previewUrl: string;
  bibNumbers: string | null;
};

export function PhotoGrid({
  eventId,
  photos,
}: {
  eventId: string;
  photos: PhotoTile[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  async function onDelete(photoId: string) {
    setDeleting(photoId);
    const res = await fetch(`/api/dashboard/events/${eventId}/photos/${photoId}`, {
      method: "DELETE",
    });
    setDeleting(null);
    if (!res.ok) {
      alert("No pudimos eliminar la foto.");
      return;
    }
    startTransition(() => router.refresh());
  }

  if (photos.length === 0) return null;

  return (
    <>
      <div className="photo-grid">
        {photos.map((p, i) => (
          <div
            key={p.id}
            className="photo-cell"
            onClick={() => setLightboxIdx(i)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") setLightboxIdx(i);
            }}
            style={{
              backgroundImage: `url(${p.previewUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            {p.bibNumbers && (
              <span
                style={{
                  position: "absolute",
                  bottom: 8,
                  left: 8,
                  padding: "2px 7px",
                  background: "rgba(15,13,11,0.78)",
                  borderRadius: 4,
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color: "var(--text-primary)",
                  backdropFilter: "blur(6px)",
                }}
              >
                #{p.bibNumbers}
              </span>
            )}
            <button
              type="button"
              className="photo-delete"
              disabled={deleting === p.id}
              onClick={(e) => {
                e.stopPropagation();
                if (confirm("¿Eliminar esta foto?")) void onDelete(p.id);
              }}
              title="Eliminar foto"
              aria-label="Eliminar foto"
              style={{
                position: "absolute",
                top: 8,
                right: 8,
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: "rgba(15,13,11,0.85)",
                border: "1px solid var(--border-default)",
                color: "var(--text-primary)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 14,
                cursor: "pointer",
                opacity: 0,
                transition: "opacity 150ms, background 150ms",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "var(--error)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "rgba(15,13,11,0.85)";
              }}
            >
              <i className="ti ti-trash" />
            </button>
          </div>
        ))}
      </div>

      {/* Reveal the per-tile delete button on hover via CSS-in-JS isn't ideal —
          inject a tiny style block for ".photo-cell:hover .photo-delete" */}
      <style>{`
        .photo-cell { position: relative; }
        .photo-cell:hover .photo-delete,
        .photo-cell:focus .photo-delete { opacity: 1 !important; }
      `}</style>

      {lightboxIdx !== null && (
        <PhotoLightbox
          photos={photos}
          startIndex={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
          onDelete={async (photoId) => {
            await onDelete(photoId);
          }}
        />
      )}
    </>
  );
}
