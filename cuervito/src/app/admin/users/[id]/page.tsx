import Link from "next/link";
import { notFound } from "next/navigation";

import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { getQuotaUsage, formatBytes } from "~/server/quotas";

import {
  reactivateUserAction,
  setUserRoleAction,
  suspendUserAction,
} from "../actions";
import { QuotaOverrideForm } from "./quota-override-form";
import { SuspendDialog } from "./suspend-dialog";

export default async function AdminUserDetail(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const session = await auth();
  const isSelf = session?.user?.id === id;

  const [user, quota, recentActions, recognitionUsage, recentDownloads, ownedEventIds] =
    await Promise.all([
      db.user.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          email: true,
          slug: true,
          role: true,
          status: true,
          createdAt: true,
          suspendedAt: true,
          suspendedReason: true,
          mpConnectedAt: true,
          lastLoginAt: true,
          storageQuotaBytes: true,
          recognitionQuotaMonthly: true,
          _count: { select: { eventsOwned: true, sales: true, photosOwned: true } },
        },
      }),
      getQuotaUsage(id).catch(() => null),
      db.adminAction.findMany({
        where: { targetType: "User", targetId: id },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { actor: { select: { name: true, email: true } } },
      }),
      db.recognitionUsage.findMany({
        where: { userId: id },
        orderBy: [{ year: "desc" }, { month: "desc" }],
        take: 6,
      }),
      db.downloadLog.findMany({
        where: { sale: { sellerId: id } },
        orderBy: { createdAt: "desc" },
        take: 15,
        include: {
          sale: {
            select: {
              id: true,
              buyerEmail: true,
              event: { select: { name: true, slug: true } },
            },
          },
        },
      }),
      db.event.findMany({
        where: { ownerId: id },
        select: { id: true, name: true, slug: true },
      }),
    ]);

  if (!user) notFound();

  // AnalyticsEvent doesn't have a direct FK to Event in Prisma (it's a loose
  // eventId String?), so we filter by the photographer's owned event IDs.
  const eventNameById = new Map(ownedEventIds.map((e) => [e.id, e]));
  const analyticsEvents = ownedEventIds.length
    ? await db.analyticsEvent.findMany({
        where: { eventId: { in: ownedEventIds.map((e) => e.id) } },
        orderBy: { createdAt: "desc" },
        take: 15,
      })
    : [];

  return (
    <main className="wrap-narrow">
      <div className="head">
        <div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
            <RolePill role={user.role} />
            <StatusPill status={user.status} />
            {user.mpConnectedAt && (
              <span className="status-pill" style={{ color: "var(--success)" }}>
                <i className="ti ti-circle-check-filled" />
                MP conectado
              </span>
            )}
          </div>
          <h1>{user.name ?? "(sin nombre)"}</h1>
          <div className="sub" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span>{user.email ?? "—"}</span>
            {user.slug && (
              <>
                <span className="sep" />
                <span style={{ fontFamily: "var(--font-mono)", color: "var(--accent)" }}>@{user.slug}</span>
              </>
            )}
            <span className="sep" />
            <span title={user.lastLoginAt ? user.lastLoginAt.toISOString() : undefined}>
              <i className="ti ti-login-2" style={{ marginRight: 4 }} />
              {user.lastLoginAt
                ? `Último login ${formatRelative(user.lastLoginAt)}`
                : "Nunca inició sesión"}
            </span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <section className="section">
        <div className="action-grid">
          <StatCard icon="ti-calendar-event" label="Eventos" value={user._count.eventsOwned.toLocaleString("es-AR")} />
          <StatCard icon="ti-photo" label="Fotos" value={user._count.photosOwned.toLocaleString("es-AR")} />
          <StatCard icon="ti-chart-bar" label="Ventas" value={user._count.sales.toLocaleString("es-AR")} />
          <StatCard
            icon="ti-database"
            label="Storage"
            value={quota ? formatBytes(quota.storage.usedBytes) : "—"}
            subValue={quota ? `${quota.storage.pct}% de ${formatBytes(quota.storage.limitBytes)}` : undefined}
          />
        </div>
      </section>

      {/* Role */}
      <section className="section">
        <div className="section-head">
          <h2>Rol</h2>
        </div>
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 14,
            padding: 22,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ fontWeight: 500 }}>
              {user.role === "ADMIN" ? "Administrador" : "Fotógrafo"}
            </div>
            <div style={{ fontSize: 13, color: "var(--text-tertiary)" }}>
              {user.role === "ADMIN"
                ? "Tiene acceso al panel admin."
                : "Acceso de fotógrafo (default)."}
            </div>
          </div>
          {isSelf ? (
            <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
              No podés cambiar tu propio rol acá.
            </span>
          ) : (
            <form action={setUserRoleAction}>
              <input type="hidden" name="userId" value={user.id} />
              <input
                type="hidden"
                name="role"
                value={user.role === "ADMIN" ? "PHOTOGRAPHER" : "ADMIN"}
              />
              <button
                type="submit"
                className="btn btn-outline"
                data-tip={
                  user.role === "ADMIN"
                    ? "Le saca acceso al panel de administración"
                    : "Le da acceso completo al panel de administración"
                }
              >
                {user.role === "ADMIN" ? "Degradar a fotógrafo" : "Promover a admin"}
              </button>
            </form>
          )}
        </div>
      </section>

      {/* Quotas */}
      <section className="section">
        <div className="section-head">
          <h2>Cuotas</h2>
        </div>
        <QuotaOverrideForm
          userId={user.id}
          currentStorageBytes={user.storageQuotaBytes?.toString() ?? null}
          currentRecognitionMonthly={user.recognitionQuotaMonthly}
          usage={quota}
        />
      </section>

      {/* Suspend / reactivate */}
      <section className="section">
        <div className="section-head">
          <h2>Acceso</h2>
        </div>
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 14,
            padding: 22,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          {user.status === "SUSPENDED" ? (
            <>
              <div>
                <div style={{ fontWeight: 500, color: "var(--error)" }}>Cuenta suspendida</div>
                <div style={{ fontSize: 13, color: "var(--text-tertiary)" }}>
                  {user.suspendedReason ?? "Sin motivo registrado."}
                  {user.suspendedAt && (
                    <> · desde {user.suspendedAt.toLocaleDateString("es-AR")}</>
                  )}
                </div>
              </div>
              <form action={reactivateUserAction}>
                <input type="hidden" name="userId" value={user.id} />
                <button
                  type="submit"
                  className="btn btn-primary"
                  data-tip="Vuelve a habilitar el login y la operación normal"
                >
                  Reactivar cuenta
                </button>
              </form>
            </>
          ) : (
            <>
              <div>
                <div style={{ fontWeight: 500 }}>Cuenta activa</div>
                <div style={{ fontSize: 13, color: "var(--text-tertiary)" }}>
                  El usuario puede iniciar sesión y operar normalmente.
                </div>
              </div>
              {isSelf ? (
                <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                  No podés suspender tu propia cuenta.
                </span>
              ) : (
                <SuspendDialog userId={user.id} userName={user.name ?? user.email ?? "este usuario"} action={suspendUserAction} />
              )}
            </>
          )}
        </div>
      </section>

      {/* Rekognition usage */}
      <section className="section">
        <div className="section-head">
          <h2>Uso de reconocimiento</h2>
          <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
            Cuota mensual: {user.recognitionQuotaMonthly?.toLocaleString("es-AR") ?? "default"}
          </div>
        </div>
        {recognitionUsage.length === 0 ? (
          <EmptyRow text="Este usuario nunca corrió reconocimiento." />
        ) : (
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.2fr 1fr 1fr 1fr",
                gap: 12,
                padding: "10px 16px",
                fontSize: 11,
                textTransform: "uppercase",
                color: "var(--text-tertiary)",
                letterSpacing: 0.5,
                borderBottom: "1px solid var(--border-subtle)",
              }}
            >
              <span>Mes</span>
              <span>Caras indexadas</span>
              <span>Búsquedas</span>
              <span>OCR</span>
            </div>
            {recognitionUsage.map((u, i) => (
              <div
                key={u.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.2fr 1fr 1fr 1fr",
                  gap: 12,
                  padding: "12px 16px",
                  borderTop: i === 0 ? "none" : "1px solid var(--border-subtle)",
                  fontSize: 13,
                }}
              >
                <span style={{ fontFamily: "var(--font-mono)" }}>
                  {u.year}-{String(u.month).padStart(2, "0")}
                </span>
                <span>{u.indexedFaces.toLocaleString("es-AR")}</span>
                <span>{u.searchedFaces.toLocaleString("es-AR")}</span>
                <span>{u.ocrCalls.toLocaleString("es-AR")}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Recent downloads */}
      <section className="section">
        <div className="section-head">
          <h2>Descargas recientes</h2>
          <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
            Compradores bajando fotos vendidas por este usuario.
          </div>
        </div>
        {recentDownloads.length === 0 ? (
          <EmptyRow text="Sin descargas registradas." />
        ) : (
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            {recentDownloads.map((d, i) => (
              <div
                key={d.id}
                style={{
                  padding: "12px 16px",
                  borderTop: i === 0 ? "none" : "1px solid var(--border-subtle)",
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 13,
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ minWidth: 0, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <i className="ti ti-download" style={{ color: "var(--accent)" }} />
                  <span>{d.sale.buyerEmail}</span>
                  {d.sale.event?.name && (
                    <>
                      <span style={{ color: "var(--text-tertiary)" }}>·</span>
                      <span style={{ color: "var(--text-tertiary)" }}>{d.sale.event.name}</span>
                    </>
                  )}
                  {d.photoId && (
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-tertiary)" }}>
                      #{d.photoId.slice(-8)}
                    </span>
                  )}
                </div>
                <span
                  style={{
                    color: "var(--text-tertiary)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    flexShrink: 0,
                  }}
                >
                  {d.createdAt.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Storefront analytics */}
      <section className="section">
        <div className="section-head">
          <h2>Actividad en storefront</h2>
          <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
            Eventos capturados en las páginas públicas de este fotógrafo.
          </div>
        </div>
        {analyticsEvents.length === 0 ? (
          <EmptyRow text="Sin actividad registrada en el storefront." />
        ) : (
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            {analyticsEvents.map((a, i) => {
              const ev = a.eventId ? eventNameById.get(a.eventId) : null;
              return (
                <div
                  key={a.id}
                  style={{
                    padding: "12px 16px",
                    borderTop: i === 0 ? "none" : "1px solid var(--border-subtle)",
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 13,
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <AnalyticsPill type={a.type} />
                    {ev && (
                      <span style={{ color: "var(--text-tertiary)" }}>en {ev.name}</span>
                    )}
                  </div>
                  <span
                    style={{
                      color: "var(--text-tertiary)",
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      flexShrink: 0,
                    }}
                  >
                    {a.createdAt.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Audit log */}
      <section className="section">
        <div className="section-head">
          <h2>Acciones recientes</h2>
        </div>
        {recentActions.length === 0 ? (
          <div
            style={{
              padding: 20,
              background: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              borderRadius: 12,
              color: "var(--text-tertiary)",
              fontSize: 13,
            }}
          >
            Sin acciones registradas.
          </div>
        ) : (
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            {recentActions.map((a, i) => (
              <div
                key={a.id}
                style={{
                  padding: "12px 16px",
                  borderTop: i === 0 ? "none" : "1px solid var(--border-subtle)",
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 13,
                  gap: 12,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <span style={{ fontFamily: "var(--font-mono)", color: "var(--accent)", fontSize: 12 }}>
                    {a.action}
                  </span>
                  <span style={{ color: "var(--text-tertiary)", marginLeft: 10 }}>
                    por {a.actor.name ?? a.actor.email}
                  </span>
                </div>
                <span style={{ color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", fontSize: 11, flexShrink: 0 }}>
                  {a.createdAt.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <Link
        href="/admin/users"
        className="btn btn-ghost"
        style={{ marginTop: 18 }}
      >
        <i className="ti ti-arrow-left" />
        Volver a la lista
      </Link>
    </main>
  );
}

function StatCard({ icon, label, value, subValue }: { icon: string; label: string; value: string; subValue?: string }) {
  return (
    <div className="action-card" style={{ minHeight: 0, cursor: "default" }}>
      <div className="action-icon">
        <i className={`ti ${icon}`} />
      </div>
      <div>
        <h3 style={{ fontSize: 22, marginBottom: 2 }}>{value}</h3>
        <p>{label}</p>
        {subValue && (
          <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 4 }}>{subValue}</p>
        )}
      </div>
    </div>
  );
}

function RolePill({ role }: { role: string }) {
  return (
    <span className="status-pill" style={role === "ADMIN" ? { color: "var(--accent)" } : undefined}>
      <i className={role === "ADMIN" ? "ti ti-shield-check" : "ti ti-user"} />
      {role === "ADMIN" ? "Admin" : "Fotógrafo"}
    </span>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <div
      style={{
        padding: 20,
        background: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 12,
        color: "var(--text-tertiary)",
        fontSize: 13,
      }}
    >
      {text}
    </div>
  );
}

function AnalyticsPill({ type }: { type: string }) {
  const map: Record<string, { icon: string; label: string; color: string }> = {
    VISIT: { icon: "ti-eye", label: "Visita", color: "var(--text-secondary)" },
    SEARCH_BIB: { icon: "ti-hash", label: "Búsqueda dorsal", color: "var(--accent)" },
    SEARCH_FACE: { icon: "ti-user-search", label: "Búsqueda facial", color: "var(--accent)" },
    CART_ADD: { icon: "ti-shopping-cart-plus", label: "Agregado al carrito", color: "var(--accent)" },
    CHECKOUT_START: { icon: "ti-credit-card", label: "Checkout iniciado", color: "var(--accent)" },
    PURCHASE: { icon: "ti-cash", label: "Compra", color: "var(--success)" },
  };
  const meta = map[type] ?? { icon: "ti-circle", label: type, color: "var(--text-tertiary)" };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 12,
        color: meta.color,
        fontFamily: "var(--font-mono)",
      }}
    >
      <i className={`ti ${meta.icon}`} />
      {meta.label}
    </span>
  );
}

function formatRelative(d: Date) {
  const diffMs = Date.now() - d.getTime();
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "hace instantes";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const days = Math.floor(h / 24);
  if (days < 30) return `hace ${days} d`;
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
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
  return (
    <span className="status-pill" style={{ color: "var(--success)" }}>
      <i className="ti ti-circle-check-filled" />
      Activo
    </span>
  );
}
