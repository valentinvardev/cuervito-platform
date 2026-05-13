"use client";

import { useEffect, useState } from "react";

import type { SaleRow } from "./ventas-client";

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

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

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
          <button
            type="button"
            className="btn btn-primary"
            style={{ width: "100%" }}
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
                Reenviar email de descarga
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
