"use client";

import { useEffect, useState } from "react";

import type { SaleRow } from "./ventas-client";

type SalePhoto = {
  id: string;
  filename: string;
  bibNumbers: string | null;
  previewUrl: string;
};

function formatARS(cents: number): string {
  return `$${(cents / 100).toLocaleString("es-AR")}`;
}

function fullDate(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SaleDrawer({
  sale,
  onClose,
}: {
  sale: SaleRow;
  onClose: () => void;
}) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [photos, setPhotos] = useState<SalePhoto[] | null>(null);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [photosError, setPhotosError] = useState<string | null>(null);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        // Don't close the drawer if the lightbox is open — it has its own
        // Escape handler.
        if (lightboxIdx === null) onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, lightboxIdx]);

  // Load the photos for this sale on mount.
  useEffect(() => {
    let cancelled = false;
    setPhotosLoading(true);
    setPhotosError(null);
    fetch(`/api/sales/${sale.id}/photos`)
      .then(async (res) => {
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? "No pudimos cargar las fotos.");
        }
        return (await res.json()) as { photos: SalePhoto[] };
      })
      .then((data) => {
        if (!cancelled) setPhotos(data.photos);
      })
      .catch((err) => {
        if (!cancelled) {
          setPhotosError(err instanceof Error ? err.message : "Error de red.");
        }
      })
      .finally(() => {
        if (!cancelled) setPhotosLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sale.id]);

  async function resendEmail() {
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/sales/${sale.id}/resend-email`, {
        method: "POST",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "No pudimos reenviar el email.");
      } else {
        setSent(true);
        setTimeout(() => setSent(false), 2200);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de red.");
    } finally {
      setSending(false);
    }
  }

  async function copyLink() {
    if (!sale.downloadToken) return;
    const url = `${window.location.origin}/descarga/${sale.downloadToken}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  }

  const canResend = sale.status === "PAID" && sale.downloadToken;
  const expired =
    sale.downloadTokenExpires &&
    new Date(sale.downloadTokenExpires) < new Date();

  return (
    <>
      <div className="drawer-backdrop open" onClick={onClose} />
      <aside className="drawer open" role="dialog" aria-label="Detalle de venta">
        <div className="drawer-head">
          <div>
            <div className="eyebrow">· Venta {sale.id.slice(0, 8)}</div>
            <h2>{sale.eventName}</h2>
            <div className="meta">
              {sale.itemCount} {sale.itemCount === 1 ? "foto" : "fotos"} ·{" "}
              <span className="accent">{formatARS(sale.totalCents)}</span>
            </div>
          </div>
          <button className="drawer-close" onClick={onClose} aria-label="Cerrar">
            <i className="ti ti-x" style={{ fontSize: 18 }} />
          </button>
        </div>

        <div className="drawer-body">
          <section className="dt-block">
            <h3>Fotos vendidas</h3>
            {photosLoading && (
              <div style={{ fontSize: 13, color: "var(--text-tertiary)" }}>
                Cargando…
              </div>
            )}
            {photosError && (
              <div style={{ fontSize: 13, color: "var(--error)" }}>
                {photosError}
              </div>
            )}
            {photos && photos.length === 0 && (
              <div style={{ fontSize: 13, color: "var(--text-tertiary)" }}>
                Sin fotos en esta venta.
              </div>
            )}
            {photos && photos.length > 0 && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))",
                  gap: 8,
                }}
              >
                {photos.map((p, i) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setLightboxIdx(i)}
                    title={p.filename}
                    style={{
                      position: "relative",
                      aspectRatio: "1",
                      borderRadius: 8,
                      overflow: "hidden",
                      border: "1px solid var(--border-subtle)",
                      padding: 0,
                      cursor: "zoom-in",
                      background: `url(${p.previewUrl}) center/cover var(--bg-elevated)`,
                    }}
                  >
                    {p.bibNumbers && (
                      <span
                        style={{
                          position: "absolute",
                          bottom: 4,
                          left: 4,
                          padding: "1px 5px",
                          background: "rgba(15,13,11,0.78)",
                          borderRadius: 3,
                          fontFamily: "var(--font-mono)",
                          fontSize: 10,
                          color: "var(--text-primary)",
                        }}
                      >
                        #{p.bibNumbers}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="dt-block">
            <h3>Comprador</h3>
            <div className="dt-row">
              <span className="lbl">Nombre</span>
              <span className="val">{sale.buyerName ?? "—"}</span>
            </div>
            <div className="dt-row">
              <span className="lbl">Email</span>
              <span className="val mono">{sale.buyerEmail}</span>
            </div>
          </section>

          <section className="dt-block">
            <h3>Cobro</h3>
            <div className="dt-row">
              <span className="lbl">Total</span>
              <span className="val mono">{formatARS(sale.totalCents)}</span>
            </div>
            <div className="dt-row">
              <span className="lbl">Comisión Cuervito</span>
              <span className="val mono">
                − {formatARS(sale.platformFeeCents)}
              </span>
            </div>
            <div className="dt-row total">
              <span className="lbl">Neto para vos</span>
              <span className="val mono accent">
                {formatARS(sale.sellerNetCents)}
              </span>
            </div>
          </section>

          <section className="dt-block">
            <h3>Estado</h3>
            <div className="dt-row">
              <span className="lbl">Estado</span>
              <span className="val">{sale.status}</span>
            </div>
            <div className="dt-row">
              <span className="lbl">Creada</span>
              <span className="val">{fullDate(sale.createdAt)}</span>
            </div>
            {sale.paidAt && (
              <div className="dt-row">
                <span className="lbl">Pagada</span>
                <span className="val">{fullDate(sale.paidAt)}</span>
              </div>
            )}
            <div className="dt-row">
              <span className="lbl">Descargas</span>
              <span className="val mono">{sale.downloadCount}</span>
            </div>
            {sale.downloadTokenExpires && (
              <div className="dt-row">
                <span className="lbl">Link expira</span>
                <span className="val">
                  {fullDate(sale.downloadTokenExpires)}
                  {expired && (
                    <span style={{ color: "var(--error)", marginLeft: 6 }}>· vencido</span>
                  )}
                </span>
              </div>
            )}
          </section>
        </div>

        {lightboxIdx !== null && photos && photos[lightboxIdx] && (
          <SalePhotoLightbox
            photos={photos}
            startIndex={lightboxIdx}
            onClose={() => setLightboxIdx(null)}
          />
        )}

        <div className="drawer-foot">
          {error && (
            <div
              style={{
                padding: "8px 12px",
                fontSize: 12.5,
                color: "var(--error)",
                background: "rgba(224,85,85,0.08)",
                border: "1px solid rgba(224,85,85,0.4)",
                borderRadius: 8,
                marginBottom: 10,
              }}
            >
              <i className="ti ti-alert-circle" /> {error}
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="btn btn-primary"
              style={{ flex: 1 }}
              disabled={!canResend || !!expired || sending || sent}
              onClick={resendEmail}
              title={
                !canResend
                  ? "Solo se puede reenviar a ventas pagadas"
                  : expired
                    ? "El link de descarga venció"
                    : undefined
              }
            >
              {sending ? (
                <>
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      border: "2px solid currentColor",
                      borderTopColor: "transparent",
                      borderRadius: "50%",
                      display: "inline-block",
                      animation: "spin 0.9s linear infinite",
                    }}
                  />
                  Enviando…
                </>
              ) : sent ? (
                <>
                  <i className="ti ti-check" />
                  Email enviado
                </>
              ) : (
                <>
                  <i className="ti ti-mail" />
                  Reenviar email
                </>
              )}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ flex: 1 }}
              disabled={!canResend || !!expired || copied}
              onClick={copyLink}
              title={
                !canResend
                  ? "Solo disponible en ventas pagadas"
                  : expired
                    ? "El link de descarga venció"
                    : undefined
              }
            >
              {copied ? (
                <>
                  <i className="ti ti-check" />
                  Link copiado
                </>
              ) : (
                <>
                  <i className="ti ti-copy" />
                  Copiar link
                </>
              )}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

function SalePhotoLightbox({
  photos,
  startIndex,
  onClose,
}: {
  photos: SalePhoto[];
  startIndex: number;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(startIndex);
  const total = photos.length;
  const current = photos[idx];

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") setIdx((i) => Math.min(i + 1, total - 1));
      else if (e.key === "ArrowLeft") setIdx((i) => Math.max(i - 1, 0));
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, total]);

  if (!current) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.92)",
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={current.previewUrl}
        alt={current.filename}
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "100%",
          maxHeight: "100%",
          objectFit: "contain",
        }}
      />

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="Cerrar"
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: "rgba(15,13,11,0.78)",
          border: "1px solid var(--border-default)",
          color: "white",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
        }}
      >
        <i className="ti ti-x" style={{ fontSize: 18 }} />
      </button>

      {total > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIdx((i) => Math.max(i - 1, 0));
            }}
            disabled={idx === 0}
            aria-label="Anterior"
            style={navBtn("left")}
          >
            <i className="ti ti-chevron-left" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIdx((i) => Math.min(i + 1, total - 1));
            }}
            disabled={idx === total - 1}
            aria-label="Siguiente"
            style={navBtn("right")}
          >
            <i className="ti ti-chevron-right" />
          </button>
        </>
      )}

      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          bottom: 16,
          left: "50%",
          transform: "translateX(-50%)",
          padding: "6px 12px",
          borderRadius: 999,
          background: "rgba(15,13,11,0.78)",
          color: "white",
          fontSize: 12,
          fontFamily: "var(--font-mono)",
        }}
      >
        {idx + 1} / {total} · {current.filename}
      </div>
    </div>
  );
}

function navBtn(side: "left" | "right"): React.CSSProperties {
  return {
    position: "absolute",
    top: "50%",
    transform: "translateY(-50%)",
    [side]: 16,
    width: 44,
    height: 44,
    borderRadius: "50%",
    background: "rgba(15,13,11,0.78)",
    border: "1px solid var(--border-default)",
    color: "white",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    fontSize: 22,
  };
}
