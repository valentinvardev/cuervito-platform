import { redirect } from "next/navigation";
import Link from "next/link";

import { auth } from "~/server/auth";
import { getCachedQuotaUsage, getDashboardCounts } from "~/server/cached";
import { db } from "~/server/db";

import { QuotaWidget } from "./_components/quota-widget";
import { SalesMini } from "./_components/sales-mini";
import { DemoSaleTrigger } from "./_components/demo-sale-trigger";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/dashboard");
  if (session.user.status === "SUSPENDED") redirect("/suspended");

  const me = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      slug: true,
      onboardingCompletedAt: true,
      mpConnectedAt: true,
      mpOnboardingSkipped: true,
    },
  });
  if (!me?.onboardingCompletedAt) redirect("/onboarding");

  const showMpBanner = !me.mpConnectedAt && !me.mpOnboardingSkipped;
  const mpConnected = !!me.mpConnectedAt;

  // Cached counts (30s revalidate) — saves ~600ms per dashboard hit.
  const [counts, quota] = await Promise.all([
    getDashboardCounts(session.user.id),
    getCachedQuotaUsage(session.user.id),
  ]);
  const { activeEvents, finishedEvents, salesCount } = counts;

  const greetingName = me.name?.split(" ")[0] ?? "fotógrafo";

  return (
    <main className="wrap">
      <DemoSaleTrigger />

      <div className="greeting">
        <h1>Buen día, {greetingName}.</h1>
        <p>
          {salesCount > 0
            ? `${salesCount.toLocaleString("es-AR")} ventas registradas.`
            : "Acá vas a gestionar tus eventos, ventas y página de venta."}
        </p>
      </div>

      {showMpBanner && (
        <div className="mp-banner">
          <div>
            <div className="ttl">
              <i className="ti ti-credit-card-pay" />
              Conectá Mercado Pago para empezar a vender
            </div>
            <div className="desc">
              Sin esto no vas a poder recibir ventas. Toma 30 segundos.
            </div>
          </div>
          <div className="actions">
            <Link href="/onboarding/mp" className="btn btn-primary">
              Conectar ahora
            </Link>
          </div>
        </div>
      )}

      <SalesMini />

      <QuotaWidget quota={quota} />

      <section className="section">
        <div className="section-head">
          <h2>Qué querés hacer hoy</h2>
        </div>

        <div className="action-grid">
          <Link className="action-card primary" href="/dashboard/events">
            <div className="action-icon">
              <i className="ti ti-calendar-event" />
            </div>
            <div>
              <h3>Eventos</h3>
              <p>Gestioná tus eventos: subí fotos, editá portada, título y descripción.</p>
            </div>
            <div className="action-foot">
              <span>
                {activeEvents} activos
                {finishedEvents > 0 ? ` · ${finishedEvents} finalizados` : ""}
              </span>
              <span className="arrow">
                <i className="ti ti-arrow-right" />
              </span>
            </div>
          </Link>

          <Link className="action-card" href="/dashboard/ventas">
            <div className="action-icon">
              <i className="ti ti-list-details" />
            </div>
            <div>
              <h3>Ventas</h3>
              <p>Detalle de cada venta, filtros por evento y exportar a CSV.</p>
            </div>
            <div className="action-foot">
              <span>
                {salesCount > 0
                  ? `${salesCount.toLocaleString("es-AR")} ventas registradas`
                  : "Sin ventas todavía"}
              </span>
              <span className="arrow">
                <i className="ti ti-arrow-right" />
              </span>
            </div>
          </Link>

          <Link className="action-card" href="/dashboard/tienda">
            <div className="action-icon">
              <i className="ti ti-template" />
            </div>
            <div>
              <h3>Página de venta</h3>
              <p>Tu storefront público. Plantillas, colores, dominio propio.</p>
            </div>
            <div className="action-foot">
              <span className="mono" style={{ fontSize: 12 }}>
                cuervito.app/{me.slug ?? "tu-usuario"}
              </span>
              <span className="arrow">
                <i className="ti ti-arrow-right" />
              </span>
            </div>
          </Link>

          <Link className="action-card" href="/dashboard/cobros">
            <div className="action-icon">
              <i className="ti ti-credit-card-pay" />
            </div>
            <div>
              <h3>Método de pago</h3>
              <p>Cómo recibís el 90% de cada venta procesada.</p>
            </div>
            <div className="action-foot">
              {mpConnected ? (
                <span
                  style={{
                    color: "var(--success)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <i className="ti ti-circle-check-filled" style={{ fontSize: 12 }} />
                  Mercado Pago conectado
                </span>
              ) : (
                <span style={{ color: "var(--text-tertiary)" }}>Sin conectar</span>
              )}
              <span className="arrow">
                <i className="ti ti-arrow-right" />
              </span>
            </div>
          </Link>

          <Link className="action-card" href="/dashboard/perfil">
            <div className="action-icon">
              <i className="ti ti-user-circle" />
            </div>
            <div>
              <h3>Mi perfil</h3>
              <p>Datos personales, bio, redes y enlace público.</p>
            </div>
            <div className="action-foot">
              <span>Perfil completo</span>
              <span className="arrow">
                <i className="ti ti-arrow-right" />
              </span>
            </div>
          </Link>

          <Link className="action-card" href="/dashboard/ayuda">
            <div className="action-icon">
              <i className="ti ti-lifebuoy" />
            </div>
            <div>
              <h3>Ayuda</h3>
              <p>Guías, FAQ y soporte directo. Respondemos en 12hs hábiles.</p>
            </div>
            <div className="action-foot">
              <span>Centro de ayuda</span>
              <span className="arrow">
                <i className="ti ti-arrow-right" />
              </span>
            </div>
          </Link>
        </div>
      </section>
    </main>
  );
}
