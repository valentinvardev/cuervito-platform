import Link from "next/link";

import { db } from "~/server/db";

const PAGE_SIZE = 25;

export default async function AdminUsersPage(props: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const sp = await props.searchParams;
  const q = (sp.q ?? "").trim();
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const where = q
    ? {
        OR: [
          { email: { contains: q, mode: "insensitive" as const } },
          { name: { contains: q, mode: "insensitive" as const } },
          { slug: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [users, total] = await Promise.all([
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
        _count: { select: { eventsOwned: true, sales: true, photosOwned: true } },
      },
    }),
    db.user.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="wrap-narrow">
      <div className="head">
        <div>
          <h1>Usuarios</h1>
          <div className="sub">
            {total.toLocaleString("es-AR")} cuentas registradas.
          </div>
        </div>
      </div>

      <form className="filters" action="/admin/users" method="get">
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
              href={`/admin/users?${new URLSearchParams({ ...(q ? { q } : {}), page: String(page - 1) }).toString()}`}
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
              href={`/admin/users?${new URLSearchParams({ ...(q ? { q } : {}), page: String(page + 1) }).toString()}`}
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
