"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

export type AdminSaleRow = {
  id: string;
  status: string;
  totalCents: number;
  platformFeeCents: number;
  sellerNetCents: number;
  buyerEmail: string;
  buyerName: string | null;
  createdAt: string;
  paidAt: string | null;
  downloadCount: number;
  eventName: string;
  sellerName: string;
  sellerSlug: string | null;
  itemCount: number;
};

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
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
  });
}

const STATUS_PILL: Record<string, { label: string; color: string }> = {
  PAID: { label: "Pagada", color: "var(--success)" },
  PENDING: { label: "Pendiente", color: "var(--warning)" },
  FAILED: { label: "Falló", color: "var(--error)" },
  REFUNDED: { label: "Reembolsada", color: "var(--text-tertiary)" },
  EXPIRED: { label: "Expirada", color: "var(--text-tertiary)" },
};

export function AdminSalesClient({
  rows,
  range,
  status,
  q,
  totals,
}: {
  rows: AdminSaleRow[];
  range: string;
  status: string;
  q: string;
  totals: {
    paidGross: number;
    platformFee: number;
    paidCount: number;
    total: number;
  };
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [search, setSearch] = useState(q);
  const [pending, startTransition] = useTransition();

  function applyFilter(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value === "all" || value === "") next.delete(key);
    else next.set(key, value);
    const qs = next.toString();
    startTransition(() => {
      router.push(`/admin/sales${qs ? `?${qs}` : ""}`);
    });
  }

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    applyFilter("q", search.trim());
  }

  return (
    <main className="wrap-ventas">
      <div className="head">
        <h1>Ventas · admin</h1>
        <div className="sub">
          Vista global de la plataforma. Filtros aplican sobre los últimos
          {" "}{range === "all" ? "todos los registros" : `últimos ${range}`}.
        </div>
      </div>

      {/* KPI tiles */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 12,
          marginBottom: 22,
        }}
      >
        <KpiTile label="Total bruto cobrado" value={formatARS(totals.paidGross)} accent />
        <KpiTile
          label="Comisión Cuervito"
          value={formatARS(totals.platformFee)}
        />
        <KpiTile
          label="Ventas pagadas"
          value={totals.paidCount.toLocaleString("es-AR")}
        />
        <KpiTile
          label="Total registros"
          value={totals.total.toLocaleString("es-AR")}
        />
      </div>

      {/* Filters */}
      <div
        className="filters"
        style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}
      >
        <form onSubmit={onSearchSubmit} style={{ flex: 1, minWidth: 220 }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar email, evento, fotógrafo, id..."
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: 8,
              background: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              color: "var(--text-primary)",
              fontSize: 13,
            }}
          />
        </form>
        <select
          value={status}
          onChange={(e) => applyFilter("status", e.target.value)}
        >
          <option value="all">Todas</option>
          <option value="PAID">Pagadas</option>
          <option value="PENDING">Pendientes</option>
          <option value="FAILED">Fallaron</option>
          <option value="REFUNDED">Reembolsadas</option>
          <option value="EXPIRED">Expiradas</option>
        </select>
        <select value={range} onChange={(e) => applyFilter("range", e.target.value)}>
          <option value="today">Hoy</option>
          <option value="7d">Últimos 7 días</option>
          <option value="30d">Últimos 30 días</option>
          <option value="all">Todo</option>
        </select>
        {pending && (
          <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
            cargando…
          </span>
        )}
      </div>

      {/* Table */}
      {rows.length === 0 ? (
        <div className="sales-empty">
          <i className="ti ti-shopping-cart-off" style={{ fontSize: 32 }} />
          <div className="ttl">Sin ventas en este rango</div>
          <div className="sub">Probá cambiar los filtros.</div>
        </div>
      ) : (
        <div
          className="sales-card"
          style={{ overflowX: "auto", padding: "4px 0" }}
        >
          <table className="admin-sales-table">
            <thead>
              <tr>
                <th>Estado</th>
                <th>Fecha</th>
                <th>Fotógrafo</th>
                <th>Evento</th>
                <th>Comprador</th>
                <th style={{ textAlign: "right" }}>Total</th>
                <th style={{ textAlign: "right" }}>Comisión</th>
                <th style={{ textAlign: "right" }}>Neto</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const pill = STATUS_PILL[s.status] ?? {
                  label: s.status,
                  color: "var(--text-tertiary)",
                };
                return (
                  <tr key={s.id}>
                    <td>
                      <span
                        className="status-pill"
                        style={{ color: pill.color, borderColor: pill.color }}
                      >
                        {pill.label}
                      </span>
                    </td>
                    <td title={s.createdAt}>{timeAgo(s.createdAt)}</td>
                    <td>
                      {s.sellerSlug ? (
                        <Link
                          href={`/${s.sellerSlug}`}
                          target="_blank"
                          rel="noopener"
                          style={{ color: "var(--accent)" }}
                        >
                          {s.sellerName}
                        </Link>
                      ) : (
                        s.sellerName
                      )}
                    </td>
                    <td>
                      {s.eventName}{" "}
                      <span style={{ color: "var(--text-tertiary)", fontSize: 12 }}>
                        ·{" "}{s.itemCount}{" "}
                        {s.itemCount === 1 ? "foto" : "fotos"}
                      </span>
                    </td>
                    <td>
                      <div>{s.buyerName ?? "—"}</div>
                      <div
                        style={{
                          fontSize: 12,
                          color: "var(--text-tertiary)",
                          fontFamily: "var(--font-mono)",
                        }}
                      >
                        {s.buyerEmail}
                      </div>
                    </td>
                    <td style={{ textAlign: "right", fontFamily: "var(--font-mono)" }}>
                      {formatARS(s.totalCents)}
                    </td>
                    <td
                      style={{
                        textAlign: "right",
                        fontFamily: "var(--font-mono)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      {formatARS(s.platformFeeCents)}
                    </td>
                    <td
                      style={{
                        textAlign: "right",
                        fontFamily: "var(--font-mono)",
                        color: "var(--accent)",
                      }}
                    >
                      {formatARS(s.sellerNetCents)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

function KpiTile({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 12,
        padding: "14px 16px",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10.5,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--text-tertiary)",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 800,
          fontSize: 22,
          letterSpacing: "-0.02em",
          color: accent ? "var(--accent)" : "var(--text-primary)",
        }}
      >
        {value}
      </div>
    </div>
  );
}
