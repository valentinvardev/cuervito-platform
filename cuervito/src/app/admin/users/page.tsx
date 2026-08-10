import Link from "next/link";

import { db } from "~/server/db";

const PAGE_SIZE = 25;

export default async function AdminUsersPage(props: {
  searchParams: Promise<{ q?: string; page?: string; mp?: string }>;
}) {
  const sp = await props.searchParams;
  const q = (sp.q ?? "").trim();
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const mp = sp.mp === "yes" || sp.mp === "no" ? sp.mp : "all";

  const searchWhere = q
    ? {
        OR: [
          { email: { contains: q, mode: "insensitive" as const } },
          { name: { contains: q, mode: "insensitive" as const } },
          { slug: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  // El filtro de MP se aplica al listado, pero los contadores de arriba
  // se calculan solo sobre la búsqueda — así el "X de Y conectados"
  // sigue teniendo sentido mientras filtrás.
  const mpWhere =
    mp === "yes"
      ? { mpConnectedAt: { not: null } }
      : mp === "no"
        ? { mpConnectedAt: null }
        : {};
  const where = { ...searchWhere, ...mpWhere };

  const [users, total, connectedCount, searchTotal] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        email: true,
        slug: true,
        role: true,
        status: true,
        createdAt: true,
        mpConnectedAt: true,
        _count: { select: { eventsOwned: true, sales: true, photosOwned: true } },
      },
    }),
    db.user.count({ where }),
    db.user.count({ where: { ...searchWhere, mpConnectedAt: { not: null } } }),
    db.user.count({ where: searchWhere }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="wrap-narrow">
      <div className="head">
        <div>
          <h1>Usuarios</h1>
          <div className="sub">
            {searchTotal.toLocaleString("es-AR")} cuentas ·{" "}
            <strong style={{ color: "var(--success)" }}>
              {connectedCount.toLocaleString("es-AR")}
            </strong>{" "}
            con Mercado Pago ·{" "}
            <strong style={{ color: "var(--warning)" }}>
              {(searchTotal - connectedCount).toLocaleString("es-AR")}
            </strong>{" "}
            sin conectar
          </div>
        </div>
      </div>

      <form className="filters" action="/admin/users" method="get">
        {mp !== "all" && <input type="hidden" name="mp" value={mp} />}
        <div className="search">
          <i className="ti ti-search" />
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Buscar por email, nombre o usuario…"
          />
          {q && (
            <Link href="/admin/users" style={{ color: "var(--text-tertiary)", fontSize: 12 }}>
              Limpiar
            </Link>
          )}
        </div>
      </form>

      <div className="mp-filter" role="group" aria-label="Filtrar por Mercado Pago">
        {(
          [
            { v: "all", label: "Todos", icon: "ti-users" },
            { v: "yes", label: "Con Mercado Pago", icon: "ti-circle-check" },
            { v: "no", label: "Sin conectar", icon: "ti-alert-circle" },
          ] as const
        ).map((o) => (
          <Link
            key={o.v}
            href={`/admin/users?${new URLSearchParams({
              ...(q ? { q } : {}),
              ...(o.v !== "all" ? { mp: o.v } : {}),
            }).toString()}`}
            className={`mp-filter-btn ${mp === o.v ? "active" : ""}`}
          >
            <i className={`ti ${o.icon}`} />
            {o.label}
          </Link>
        ))}
      </div>

      <div className="event-list">
        {users.map((u) => (
          <Link key={u.id} href={`/admin/users/${u.id}`} className="event-item">
            <div
              className="ev-thumb"
              style={{
                background:
                  u.role === "ADMIN"
                    ? "linear-gradient(135deg, rgba(245,130,10,0.4), rgba(245,130,10,0.1))"
                    : undefined,
              }}
            >
              <i
                className={u.role === "ADMIN" ? "ti ti-shield-check" : "ti ti-user"}
                style={{ fontSize: 24 }}
              />
            </div>
            <div className="ev-info">
              <div className="title">{u.name ?? "(sin nombre)"}</div>
              <div className="sub">
                <span>{u.email ?? "—"}</span>
                <span className="sep" />
                <span>{u._count.eventsOwned} eventos</span>
                <span className="sep" />
                <span>{u._count.sales} ventas</span>
                <span className="sep" />
                <RolePill role={u.role} />
                <span className="sep" />
                <MpPill connectedAt={u.mpConnectedAt} />
                {u.status !== "ACTIVE" && (
                  <>
                    <span className="sep" />
                    <StatusPill status={u.status} />
                  </>
                )}
              </div>
            </div>
            <div className="ev-revenue">
              <div className="amt">{u.slug ? `@${u.slug}` : "—"}</div>
              <div className="photos">
                {u.createdAt.toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "2-digit" })}
              </div>
            </div>
            <i className="ti ti-chevron-right ev-arrow" />
          </Link>
        ))}
        {users.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: "32px 16px",
              color: "var(--text-tertiary)",
              fontSize: 14,
            }}
          >
            No encontramos usuarios.
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 22 }}>
          {page > 1 && (
            <Link
              href={`/admin/users?${new URLSearchParams({ ...(q ? { q } : {}), ...(mp !== "all" ? { mp } : {}), page: String(page - 1) }).toString()}`}
              className="btn btn-outline"
              style={{ height: 36, padding: "0 14px", fontSize: 13 }}
            >
              <i className="ti ti-arrow-left" />
              Anterior
            </Link>
          )}
          <span
            style={{
              alignSelf: "center",
              fontSize: 13,
              color: "var(--text-tertiary)",
              padding: "0 12px",
            }}
          >
            Página {page} de {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={`/admin/users?${new URLSearchParams({ ...(q ? { q } : {}), ...(mp !== "all" ? { mp } : {}), page: String(page + 1) }).toString()}`}
              className="btn btn-outline"
              style={{ height: 36, padding: "0 14px", fontSize: 13 }}
            >
              Siguiente
              <i className="ti ti-arrow-right" />
            </Link>
          )}
        </div>
      )}
    </main>
  );
}

/** Estado de conexión con Mercado Pago. Sin conectar el fotógrafo no
 *  puede cobrar, así que ese estado se marca en ámbar para que salte. */
function MpPill({ connectedAt }: { connectedAt: Date | null }) {
  if (connectedAt) {
    return (
      <span
        className="status-pill"
        style={{ color: "var(--success)" }}
        title={`Conectado el ${connectedAt.toLocaleDateString("es-AR")}`}
      >
        <i className="ti ti-circle-check-filled" style={{ fontSize: 12 }} />
        MP
      </span>
    );
  }
  return (
    <span
      className="status-pill"
      style={{ color: "var(--warning)", borderColor: "rgba(245,200,66,0.4)" }}
      title="No puede cobrar hasta conectar Mercado Pago"
    >
      <i className="ti ti-alert-circle" style={{ fontSize: 12 }} />
      Sin MP
    </span>
  );
}

function RolePill({ role }: { role: string }) {
  if (role === "ADMIN") {
    return (
      <span className="status-pill" style={{ color: "var(--accent)" }}>
        <i className="ti ti-shield-check" />
        Admin
      </span>
    );
  }
  return (
    <span className="status-pill">
      <i className="ti ti-user" />
      Fotógrafo
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
  if (status === "SUSPENDED") {
    return (
      <span className="status-pill" style={{ color: "var(--error)", borderColor: "rgba(224,85,85,0.4)" }}>
        <i className="ti ti-ban" />
        Suspendido
      </span>
    );
  }
  if (status === "DELETED") {
    return (
      <span className="status-pill" style={{ color: "var(--text-tertiary)" }}>
        <i className="ti ti-trash" />
        Eliminado
      </span>
    );
  }
  return null;
}
