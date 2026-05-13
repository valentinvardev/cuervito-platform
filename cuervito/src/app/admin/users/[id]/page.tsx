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

  const [user, quota, recentActions] = await Promise.all([
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
  ]);

  if (!user) notFound();

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
              <button type="submit" className="btn btn-outline">
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
                <button type="submit" className="btn btn-primary">
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
