"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { Select } from "~/app/_components/select";

import { loadMoreAdminSalesAction } from "./actions";

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
  initialRows,
  initialHasMore,
  range,
  status,
  q,
  totals,
  pageSize,
}: {
  initialRows: AdminSaleRow[];
  initialHasMore: boolean;
  range: string;
  status: string;
  q: string;
  totals: {
    paidGross: number;
    platformFee: number;
    paidCount: number;
    total: number;
  };
  pageSize: number;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [search, setSearch] = useState(q);
  const [pending, startTransition] = useTransition();

  // Rows paginados en client — se hidratan con los que trajo el server.
  const [rows, setRows] = useState<AdminSaleRow[]>(initialRows);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadAllProgress, setLoadAllProgress] = useState<number | null>(null);

  // Si el server manda otra tanda (por cambio de filtros vía SPA nav)
  // reseteamos las rows locales.
  useEffect(() => {
    setRows(initialRows);
    setHasMore(initialHasMore);
    setLoadAllProgress(null);
  }, [initialRows, initialHasMore]);

  function applyFilter(key: string, value: string) {
    const next = new URLSearchParams(params);
    // Para 'status' el default del server ya es 'all' → borrar el param
    // deja la URL prolija. Para 'range' el default es '30d', así que
    // siempre lo persistimos (aunque sea 'all') para no perder la
    // intención del usuario en un refresh.
    if (value === "") next.delete(key);
    else if (key === "status" && value === "all") next.delete(key);
    else next.set(key, value);
    const qs = next.toString();
    startTransition(() => {
      router.push(`/admin/sales${qs ? `?${qs}` : ""}`);
    });
  }

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const res = await loadMoreAdminSalesAction({
        range,
        status,
        q,
        offset: rows.length,
        take: pageSize,
      });
      setRows((prev) => [...prev, ...res.rows]);
      setHasMore(res.hasMore);
    } finally {
      setLoadingMore(false);
    }
  }

  async function loadAll() {
    if (loadingMore) return;
    const remaining = totals.total - rows.length;
    if (remaining <= 0) return;
    if (remaining > 500) {
      const ok = confirm(
        `Vas a cargar ${remaining.toLocaleString("es-AR")} ventas más de una sola vez. Puede tardar y ralentizar la vista. ¿Seguir?`,
      );
      if (!ok) return;
    }
    setLoadingMore(true);
    setLoadAllProgress(rows.length);
    try {
      let offset = rows.length;
      let more = true;
      const acc: AdminSaleRow[] = [];
      const BATCH = 200;
      while (more) {
        const res = await loadMoreAdminSalesAction({
          range,
          status,
          q,
          offset,
          take: BATCH,
        });
        acc.push(...res.rows);
        offset += res.rows.length;
        more = res.hasMore;
        setLoadAllProgress(rows.length + acc.length);
      }
      setRows((prev) => [...prev, ...acc]);
      setHasMore(false);
    } finally {
      setLoadingMore(false);
      setLoadAllProgress(null);
    }
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
        <Select
          ariaLabel="Filtrar por estado"
          icon="ti-filter"
          value={status}
          onChange={(v) => applyFilter("status", v)}
          options={[
            { value: "all", label: "Todas" },
            { value: "PAID", label: "Pagadas" },
            { value: "PENDING", label: "Pendientes" },
            { value: "FAILED", label: "Fallaron" },
            { value: "REFUNDED", label: "Reembolsadas" },
            { value: "EXPIRED", label: "Expiradas" },
          ]}
        />
        <Select
          ariaLabel="Filtrar por rango"
          icon="ti-calendar-stats"
          value={range}
          onChange={(v) => applyFilter("range", v)}
          options={[
            { value: "today", label: "Hoy" },
            { value: "7d", label: "Últimos 7 días", meta: "7d" },
            { value: "30d", label: "Últimos 30 días", meta: "30d" },
            { value: "all", label: "Todo" },
          ]}
        />
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

      {rows.length > 0 && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            marginTop: 18,
            padding: "12px 4px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ fontSize: 12.5, color: "var(--text-tertiary)" }}>
            Mostrando <strong style={{ color: "var(--text-primary)" }}>{rows.length.toLocaleString("es-AR")}</strong>{" "}
            de <strong style={{ color: "var(--text-primary)" }}>{totals.total.toLocaleString("es-AR")}</strong>{" "}
            registros
            {loadAllProgress != null && (
              <> · cargando… ({loadAllProgress.toLocaleString("es-AR")})</>
            )}
          </div>
          {hasMore && (
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={loadMore}
                disabled={loadingMore}
              >
                {loadingMore && loadAllProgress == null
                  ? "Cargando…"
                  : `Cargar ${pageSize} más`}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={loadAll}
                disabled={loadingMore}
                title="Trae todos los registros restantes de una vez. Puede afectar el rendimiento con muchos datos."
              >
                Cargar todas
              </button>
            </div>
          )}
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
