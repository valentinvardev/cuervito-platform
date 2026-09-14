import Link from "next/link";
import { ChevronRight, Search, ShieldCheck, Users } from "lucide-react";

import { db } from "~/server/db";

import { hace, iniciales } from "~/app/dashboard/_components/formato";

export const dynamic = "force-dynamic";

const PAGINA = 25;

/**
 * Los fotógrafos, con lo que hace falta para decidir a quién mirar.
 *
 * Es la misma lista de siempre, escrita con el vocabulario del panel —fila,
 * píldora, tarjeta, segmentado— y no con las clases del prototipo de
 * cuervito. Lo que se ve es lo que ve el fotógrafo en Ventas, con otras
 * columnas.
 */
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

  // El filtro de MP se aplica al listado, pero los contadores de arriba se
  // calculan sólo sobre la búsqueda: así el "X de Y conectados" sigue
  // teniendo sentido mientras filtrás.
  const mpWhere =
    mp === "yes" ? { mpConnectedAt: { not: null } } : mp === "no" ? { mpConnectedAt: null } : {};
  const where = { ...searchWhere, ...mpWhere };

  const [users, total, conMp, enBusqueda] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGINA,
      take: PAGINA,
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

  const paginas = Math.max(1, Math.ceil(total / PAGINA));
  const url = (cambios: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const todo = { q: q || undefined, mp: mp !== "all" ? mp : undefined, ...cambios };
    for (const [k, v] of Object.entries(todo)) if (v) p.set(k, v);
    const s = p.toString();
    return `/admin/users${s ? `?${s}` : ""}`;
  };

  return (
    <main className="canvas">
      <div className="canvas-in">
        <div className="head">
          <div>
            <h1>Usuarios</h1>
            <p>
              {enBusqueda.toLocaleString("es-AR")} cuentas · {conMp.toLocaleString("es-AR")} con
              Mercado Pago · {(enBusqueda - conMp).toLocaleString("es-AR")} sin conectar
            </p>
          </div>
        </div>

        <div className="filtros">
          <form action="/admin/users" method="get" style={{ flex: 1, minWidth: 220, maxWidth: 420 }}>
            {mp !== "all" && <input type="hidden" name="mp" value={mp} />}
            <div style={{ position: "relative" }}>
              <Search
                style={{
                  position: "absolute",
                  left: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: 15,
                  height: 15,
                  color: "var(--ink-3)",
                }}
              />
              <input
                type="search"
                name="q"
                className="inp"
                defaultValue={q}
                placeholder="Buscar por email, nombre o usuario"
                style={{ paddingLeft: 36 }}
              />
            </div>
          </form>

          {/* Segmentado con links y no botones: la lista filtra por URL, y una
              URL con filtro se puede guardar y mandar. */}
          <div className="seg" role="group" aria-label="Filtrar por Mercado Pago">
            <Link href={url({ mp: undefined, page: undefined })} aria-current={mp === "all" ? "true" : undefined}>
              Todos
            </Link>
            <Link href={url({ mp: "yes", page: undefined })} aria-current={mp === "yes" ? "true" : undefined}>
              Con Mercado Pago
            </Link>
            <Link href={url({ mp: "no", page: undefined })} aria-current={mp === "no" ? "true" : undefined}>
              Sin conectar
            </Link>
          </div>

          {q && (
            <Link href={url({ q: undefined, page: undefined })} className="btn btn-ghost btn-sm sp">
              Limpiar búsqueda
            </Link>
          )}
        </div>

        <section className="card">
          {users.length === 0 ? (
            <div className="empty">
              <div className="empty-i">
                <Users />
              </div>
              <h3>No encontramos usuarios</h3>
              <p>Probá con otro nombre, mail o usuario.</p>
            </div>
          ) : (
            <>
              <div className="row row-h ut">
                <span />
                <span>Cuenta</span>
                <span className="num oc">Eventos</span>
                <span className="num oc">Ventas</span>
                <span className="num oc">Fotos</span>
                <span className="oc" />
                <span className="oc" />
                <span className="num oc">Alta</span>
                <span />
              </div>

              {users.map((u) => (
                <Link key={u.id} href={`/admin/users/${u.id}`} className="row ut">
                  <span className="v-av" style={u.role === "ADMIN" ? { color: "var(--accent)" } : undefined}>
                    {u.role === "ADMIN" ? (
                      <ShieldCheck style={{ width: 14, height: 14 }} />
                    ) : (
                      iniciales(u.name ?? u.email ?? "?")
                    )}
                  </span>
                  <span className="v-who">
                    <b>
                      {u.name ?? "(sin nombre)"}
                      {u.slug && (
                        <span style={{ fontWeight: 400, color: "var(--ink-3)", marginLeft: 6 }}>
                          @{u.slug}
                        </span>
                      )}
                    </b>
                    <span>{u.email ?? "—"}</span>
                  </span>
                  <span className="num soft oc tnum">{u._count.eventsOwned}</span>
                  <span className="num soft oc tnum">{u._count.sales}</span>
                  <span className="num soft oc tnum">{u._count.photosOwned.toLocaleString("es-AR")}</span>
                  <span className="oc">
                    {u.mpConnectedAt ? (
                      <span className="pill live" title={`Conectado el ${u.mpConnectedAt.toLocaleDateString("es-AR")}`}>
                        <i /> MP
                      </span>
                    ) : (
                      <span className="pill draft" title="No puede cobrar hasta conectar Mercado Pago">
                        <i /> Sin MP
                      </span>
                    )}
                  </span>
                  <span className="oc">
                    {u.status === "SUSPENDED" ? (
                      <span className="pill bad">
                        <i /> Suspendido
                      </span>
                    ) : u.role === "ADMIN" ? (
                      <span className="pill draft">
                        <i /> Admin
                      </span>
                    ) : (
                      <span className="pill">
                        <i /> Fotógrafo
                      </span>
                    )}
                  </span>
                  <span className="num soft oc" title={u.createdAt.toLocaleDateString("es-AR")}>
                    {hace(u.createdAt)}
                  </span>
                  <ChevronRight className="go" style={{ width: 16, height: 16, color: "var(--ink-3)" }} />
                </Link>
              ))}
            </>
          )}
        </section>

        {paginas > 1 && (
          <div className="filtros" style={{ justifyContent: "center" }}>
            {page > 1 && (
              <Link href={url({ page: String(page - 1) })} className="btn btn-ghost btn-sm">
                Anterior
              </Link>
            )}
            <span style={{ fontSize: 13, color: "var(--ink-3)" }}>
              Página {page} de {paginas}
            </span>
            {page < paginas && (
              <Link href={url({ page: String(page + 1) })} className="btn btn-ghost btn-sm">
                Siguiente
              </Link>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
