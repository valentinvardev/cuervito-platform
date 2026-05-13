"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { SaleDrawer } from "./sale-drawer";

export type SaleRow = {
  id: string;
  status: "PENDING" | "PAID" | "FAILED" | "REFUNDED" | "CANCELLED" | "EXPIRED";
  totalCents: number;
  platformFeeCents: number;
  sellerNetCents: number;
  buyerEmail: string;
  buyerName: string | null;
  createdAt: string;
  paidAt: string | null;
  downloadCount: number;
  downloadToken: string | null;
  downloadTokenExpires: string | null;
  eventName: string;
  eventSlug: string;
  firstBib: string | null;
  itemCount: number;
  thumbUrl: string | null;
};

type EventOpt = { id: string; name: string };

function formatARS(cents: number): string {
  return `$${(cents / 100).toLocaleString("es-AR")}`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "hace un momento";
  if (min < 60) return `hace ${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `hace ${hr} h`;
  const d = Math.floor(hr / 24);
  if (d === 1) return "ayer";
  if (d < 30) return `hace ${d} días`;
  return new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short" });
}

const STATUS_LABELS: Record<SaleRow["status"], { label: string; color: string }> = {
  PAID: { label: "Pagada", color: "var(--success)" },
  PENDING: { label: "Pendiente", color: "var(--warning)" },
  FAILED: { label: "Falló", color: "var(--error)" },
  REFUNDED: { label: "Reembolsada", color: "var(--text-tertiary)" },
  CANCELLED: { label: "Cancelada", color: "var(--text-tertiary)" },
  EXPIRED: { label: "Expirada", color: "var(--text-tertiary)" },
};

export function VentasClient({
  rows,
  events,
  eventFilter,
  range,
  totals,
}: {
  rows: SaleRow[];
  events: EventOpt[];
  eventFilter: string;
  range: string;
  totals: { paidCents: number; paidCount: number; pendingCount: number };
}) {
  const router = useRouter();
  const [openSale, setOpenSale] = useState<SaleRow | null>(null);

  function updateFilter(key: "event" | "range", val: string) {
    const sp = new URLSearchParams();
    if (key === "event") {
      if (val !== "all") sp.set("event", val);
      if (range !== "30d") sp.set("range", range);
    } else {
      if (eventFilter !== "all") sp.set("event", eventFilter);
      if (val !== "30d") sp.set("range", val);
    }
    const qs = sp.toString();
    router.push(`/dashboard/ventas${qs ? `?${qs}` : ""}`);
  }

  return (
    <main className="wrap-ventas">
      <div className="head">
        <h1>Ventas</h1>
        <div className="sub">
          {totals.paidCount.toLocaleString("es-AR")}{" "}
          {totals.paidCount === 1 ? "venta cobrada" : "ventas cobradas"} ·{" "}
          <span style={{ color: "var(--accent)" }}>{formatARS(totals.paidCents)}</span>{" "}
          neto · cobros automáticos por Mercado Pago.
        </div>
      </div>

      <div className="filters">
        <select
          value={eventFilter}
          onChange={(e) => updateFilter("event", e.target.value)}
        >
          <option value="all">Todos los eventos</option>
          {events.map((ev) => (
            <option key={ev.id} value={ev.id}>
              {ev.name}
            </option>
          ))}
        </select>
        <select value={range} onChange={(e) => updateFilter("range", e.target.value)}>
          <option value="today">Hoy</option>
          <option value="7d">Últimos 7 días</option>
          <option value="30d">Últimos 30 días</option>
          <option value="all">Todo</option>
        </select>
      </div>

      {rows.length === 0 ? (
        <div className="sales-empty">
          <i className="ti ti-shopping-cart-off" style={{ fontSize: 32 }} />
          <div className="ttl">Todavía no hay ventas</div>
          <div className="sub">
            Cuando alguien compre tus fotos, vas a verlo acá.
          </div>
        </div>
      ) : (
        <div className="sales-card">
          {rows.map((s) => {
            const status = STATUS_LABELS[s.status];
            return (
              <button
                key={s.id}
                type="button"
                className="sale-row"
                onClick={() => setOpenSale(s)}
              >
                <div
                  className="sale-thumb"
                  style={
                    s.thumbUrl
                      ? {
                          backgroundImage: `url(${s.thumbUrl})`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }
                      : { background: "var(--bg-elevated)" }
                  }
                />
                <div className="sale-info">
                  <div className="ttl">
                    {s.eventName} · {s.itemCount}{" "}
                    {s.itemCount === 1 ? "foto" : "fotos"}
                  </div>
                  <div className="meta">
                    {s.firstBib && <span className="bib-mini">#{s.firstBib}</span>}
                    <span>{s.buyerName ?? s.buyerEmail}</span>
                    <span className="dot">·</span>
                    <span>{timeAgo(s.createdAt)}</span>
                    <span
                      className="status-pill"
                      style={{ color: status.color, borderColor: status.color }}
                    >
                      {status.label}
                    </span>
                  </div>
                </div>
                <span className="price">{formatARS(s.totalCents)}</span>
              </button>
            );
          })}
        </div>
      )}

      {openSale && (
        <SaleDrawer sale={openSale} onClose={() => setOpenSale(null)} />
      )}
    </main>
  );
}
