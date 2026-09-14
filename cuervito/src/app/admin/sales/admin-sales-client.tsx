"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ShoppingCart } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

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

/* Estado → píldora del panel. "live" es plata que entró; "draft" es el acento,
   para lo que está en curso o se regaló; "bad" para lo que no va a cobrarse. */
const ESTADO: Record<string, { txt: string; cls: string }> = {
  PAID: { txt: "Pagada", cls: "live" },
  PENDING: { txt: "Pendiente", cls: "draft" },
  FAILED: { txt: "Falló", cls: "bad" },
  REFUNDED: { txt: "Reembolsada", cls: "bad" },
  EXPIRED: { txt: "Expirada", cls: "bad" },
  GIFT: { txt: "Regalo", cls: "draft" },
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

  const n = (x: number) => x.toLocaleString("es-AR");
  const seg = (
    actual: string,
    clave: string,
    opciones: { v: string; t: string }[],
    rotulo: string,
  ) => (
    <div className="seg" role="group" aria-label={rotulo}>
      {opciones.map((o) => (
        <button
          key={o.v}
          type="button"
          aria-pressed={actual === o.v}
          onClick={() => applyFilter(clave, o.v)}
          disabled={pending}
        >
          {o.t}
        </button>
      ))}
    </div>
  );
  return (
    <main className="canvas">
      <div className="canvas-in">
        <div className="head">
          <div>
            <h1>Ventas</h1>
            <p>
              Toda la plataforma ·{" "}
              {range === "all" ? "desde el principio" : range === "today" ? "hoy" : `últimos ${range.replace("d", " días")}`}
              {q && ` · buscando “${q}”`}
            </p>
          </div>
        </div>

        <section className="sum k4">
          <div className="card neto">
            <div className="k-lab">Bruto cobrado</div>
            <div className="k-n tnum">{formatARS(totals.paidGross)}</div>
            <div className="k-sub">{n(totals.paidCount)} ventas pagadas</div>
          </div>
          <div className="card">
            <div className="k-lab">Comisión</div>
            <div className="k-n tnum">{formatARS(totals.platformFee)}</div>
          </div>
          <div className="card">
            <div className="k-lab">Ventas pagadas</div>
            <div className="k-n tnum">{n(totals.paidCount)}</div>
          </div>
          <div className="card">
            <div className="k-lab">Registros</div>
            <div className="k-n tnum">{n(totals.total)}</div>
            <div className="k-sub">con los filtros de abajo</div>
          </div>
        </section>

        <div className="filtros">
          <form onSubmit={onSearchSubmit} style={{ flex: 1, minWidth: 220, maxWidth: 420 }}>
            <input
              type="search"
              className="inp"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por email, evento, fotógrafo o id"
            />
          </form>
          {seg(status, "status", [
            { v: "all", t: "Todas" },
            { v: "PAID", t: "Pagadas" },
            { v: "PENDING", t: "Pendientes" },
            { v: "GIFT", t: "Regaladas" },
            { v: "FAILED", t: "Fallaron" },
            { v: "REFUNDED", t: "Reembolsadas" },
            { v: "EXPIRED", t: "Expiradas" },
          ], "Filtrar por estado")}
          {seg(range, "range", [
            { v: "today", t: "Hoy" },
            { v: "7d", t: "7 días" },
            { v: "30d", t: "30 días" },
            { v: "all", t: "Todo" },
          ], "Filtrar por período")}
          {pending && <span style={{ fontSize: 12, color: "var(--ink-3)" }}>cargando…</span>}
        </div>

        <section className="card">
          {rows.length === 0 ? (
            <div className="empty">
              <div className="empty-i">
                <ShoppingCart />
              </div>
              <h3>Sin ventas en este rango</h3>
              <p>Probá cambiar los filtros.</p>
            </div>
          ) : (
            <>
              <div className="row row-h at">
                <span />
                <span className="oc">Cuándo</span>
                <span className="oc">Fotógrafo</span>
                <span className="oc">Evento</span>
                <span>Comprador</span>
                <span className="num oc">Total</span>
                <span className="num oc">Comisión</span>
                <span className="num">Neto</span>
              </div>

              {rows.map((s) => {
                const e = ESTADO[s.status] ?? { txt: s.status, cls: "" };
                return (
                  <div key={s.id} className="row at">
                    <span>
                      <span className={`pill ${e.cls}`}>
                        <i /> {e.txt}
                      </span>
                    </span>
                    <span className="num soft oc" style={{ textAlign: "left" }} title={s.createdAt}>
                      {timeAgo(s.createdAt)}
                    </span>
                    <span className="v-ev oc">
                      {s.sellerSlug ? (
                        <Link href={`/${s.sellerSlug}`} target="_blank" rel="noopener" className="v-link">
                          {s.sellerName}
                        </Link>
                      ) : (
                        s.sellerName
                      )}
                    </span>
                    <span className="v-ev oc">
                      {s.eventName}
                      <span style={{ color: "var(--ink-3)" }}>
                        {" "}· {s.itemCount} {s.itemCount === 1 ? "foto" : "fotos"}
                      </span>
                    </span>
                    <span className="v-who">
                      <b>{s.buyerName ?? "—"}</b>
                      <span>{s.buyerEmail}</span>
                    </span>
                    <span className="num tnum oc">{formatARS(s.totalCents)}</span>
                    <span className="num soft tnum oc">{formatARS(s.platformFeeCents)}</span>
                    <span className="num tnum neto">{formatARS(s.sellerNetCents)}</span>
                  </div>
                );
              })}
            </>
          )}
        </section>

        {rows.length > 0 && (
          <div className="filtros">
            <span style={{ fontSize: 13, color: "var(--ink-3)" }}>
              Mostrando <b className="tnum" style={{ color: "var(--ink)", fontWeight: 500 }}>{n(rows.length)}</b> de{" "}
              <b className="tnum" style={{ color: "var(--ink)", fontWeight: 500 }}>{n(totals.total)}</b>
              {loadAllProgress != null && <> · cargando… ({n(loadAllProgress)})</>}
            </span>
            {hasMore && (
              <div className="sp" style={{ display: "flex", gap: "var(--s-2)" }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={loadMore}
                  disabled={loadingMore}
                  data-tip="Traer la siguiente tanda"
                >
                  {loadingMore && loadAllProgress == null ? "Cargando…" : `Cargar ${pageSize} más`}
                </button>
                <button
                  type="button"
                  className="btn btn-pri btn-sm"
                  onClick={loadAll}
                  disabled={loadingMore}
                  data-tip="Trae todo lo que falta de una vez. Con muchos datos puede tardar."
                >
                  Cargar todas
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
