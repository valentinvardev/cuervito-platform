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

  // ── selection mode ──────────────────────────────────────────────────────
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(photos.map((p) => p.id)));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  function exitSelectionMode() {
    setSelectionMode(false);
    setSelected(new Set());
    setBulkError(null);
  }

  async function onDelete(photoId: string) {
    setDeleting(photoId);
    const res = await fetch(`/api/dashboard/events/${eventId}/photos/${photoId}`, {
      method: "DELETE",
    });
    setDeleting(null);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      alert(data.error ?? "No pudimos eliminar la foto.");
      return;
    }
    startTransition(() => router.refresh());
  }

  async function onBulkDelete() {
    if (selected.size === 0) return;
    if (
      !confirm(
        `¿Eliminar ${selected.size} ${selected.size === 1 ? "foto" : "fotos"}? Esta acción no se puede deshacer.`,
      )
    ) {
      return;
    }
    setBulkBusy(true);
    setBulkError(null);
    try {
      const res = await fetch(
        `/api/dashboard/events/${eventId}/photos/bulk-delete`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ photoIds: Array.from(selected) }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        deleted?: number;
        skippedSold?: string[];
      };
      if (!res.ok) {
        setBulkError(data.error ?? "No pudimos eliminar las fotos.");
        setBulkBusy(false);
        return;
      }
      const skipped = data.skippedSold?.length ?? 0;
      const deletedN = data.deleted ?? 0;
      // Reset selection regardless of skip count.
      const finalMsg =
        skipped > 0
          ? `${deletedN} eliminadas · ${skipped} no se borraron porque ya fueron vendidas.`
          : null;
      setSelectionMode(false);
      setSelected(new Set());
      setBulkError(finalMsg);
      startTransition(() => router.refresh());
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : "Error de red.");
    } finally {
      setBulkBusy(false);
    }
  }

  if (photos.length === 0) return null;

  const allSelected = selected.size === photos.length && photos.length > 0;

  return (
    <>
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 14,
          flexWrap: "wrap",
        }}
      >
        {!selectionMode ? (
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => setSelectionMode(true)}
            style={{ padding: "8px 14px", fontSize: 13, height: 36 }}
          >
            <i className="ti ti-checkbox" />
            Seleccionar
          </button>
        ) : (
          <>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={exitSelectionMode}
              style={{ padding: "8px 12px", fontSize: 13, height: 36 }}
            >
              <i className="ti ti-x" />
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={allSelected ? clearSelection : selectAll}
              style={{ padding: "8px 12px", fontSize: 13, height: 36 }}
            >
              {allSelected ? "Quitar selección" : "Seleccionar todas"}
            </button>
            <span
              style={{
                marginLeft: "auto",
                fontSize: 13,
                color: "var(--text-secondary)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {selected.size} {selected.size === 1 ? "seleccionada" : "seleccionadas"}
            </span>
            <button
              type="button"
              className="btn btn-danger"
              onClick={onBulkDelete}
              disabled={selected.size === 0 || bulkBusy}
              style={{ padding: "8px 14px", fontSize: 13, height: 36 }}
            >
              <i className="ti ti-trash" />
              {bulkBusy
                ? "Eliminando…"
                : selected.size > 0
                  ? `Eliminar ${selected.size}`
                  : "Eliminar"}
            </button>
          </>
        )}
      </div>

      {bulkError && (
        <div
          style={{
            marginBottom: 12,
            padding: "10px 14px",
            background: "rgba(224,85,85,0.08)",
            border: "1px solid rgba(224,85,85,0.4)",
            borderRadius: 8,
            color: "var(--error)",
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <i className="ti ti-alert-circle" />
          {bulkError}
        </div>
      )}

      <div className="photo-grid">
        {photos.map((p, i) => {
          const isSelected = selected.has(p.id);
          return (
            <div
              key={p.id}
              className={`photo-cell ${isSelected ? "is-selected" : ""}`}
              onClick={() => {
                if (selectionMode) toggle(p.id);
                else setLightboxIdx(i);
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  if (selectionMode) toggle(p.id);
                  else setLightboxIdx(i);
                }
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

              {selectionMode && (
                <span
                  className="photo-checkbox"
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    top: 8,
                    left: 8,
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    background: isSelected
                      ? "var(--accent)"
                      : "rgba(15,13,11,0.78)",
                    border: isSelected
                      ? "2px solid var(--accent)"
                      : "2px solid rgba(255,255,255,0.5)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: isSelected ? "#1a0d00" : "transparent",
                    fontSize: 14,
                    transition: "background 120ms, border-color 120ms",
                  }}
                >
                  <i className="ti ti-check" />
                </span>
              )}

              {!selectionMode && (
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
                    (e.currentTarget as HTMLButtonElement).style.background =
                      "var(--error)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background =
                      "rgba(15,13,11,0.85)";
                  }}
                >
                  <i className="ti ti-trash" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <style>{`
        .photo-cell { position: relative; cursor: pointer; }
        .photo-cell:hover .photo-delete,
        .photo-cell:focus .photo-delete { opacity: 1 !important; }
        .photo-cell.is-selected::after {
          content: '';
          position: absolute;
          inset: 0;
          background: rgba(245,130,10,0.18);
          border: 2px solid var(--accent);
          border-radius: 8px;
          pointer-events: none;
        }
      `}</style>

      {lightboxIdx !== null && !selectionMode && (
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
