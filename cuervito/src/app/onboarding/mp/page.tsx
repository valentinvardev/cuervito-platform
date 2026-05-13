import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "~/server/auth";
import { db } from "~/server/db";

import { skipMpAction } from "../actions";
import { ObShell } from "../ob-shell";

export default async function OnboardingMpPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/onboarding/mp");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { onboardingCompletedAt: true, mpConnectedAt: true, mpOnboardingSkipped: true },
  });
  if (!user) redirect("/login");
  if (!user.onboardingCompletedAt) redirect("/onboarding");
  if (user.mpConnectedAt || user.mpOnboardingSkipped) redirect("/onboarding/welcome");

  return (
    <ObShell step={2}>
      <section className="step-content">
        <div className="ob-form-head">
          <span className="ob-eyebrow">Paso 2 de 2</span>
          <h1>Conectá Mercado Pago.</h1>
          <p>Las ventas se acreditan directo en tu cuenta. Vos recibís el 90%, Cuervito retiene 10%.</p>
        </div>

        <div className="mp-card">
          <div className="mp-row">
            <div className="mp-logo">
              <img src="/assets/mp/mp-pluma-vertical.svg" alt="Mercado Pago" />
            </div>
            <div>
              <h3>Mercado Pago</h3>
              <div className="mp-sub">Vinculá tu cuenta en 30 segundos.</div>
            </div>
          </div>

          <ul className="mp-bullets">
            <li><i className="ti ti-check"></i>Comisión Cuervito: 10% por venta</li>
            <li><i className="ti ti-check"></i>Acreditación instantánea en tu cuenta</li>
            <li><i className="ti ti-check"></i>Usás tu cuenta MP personal — sin formularios</li>
          </ul>

          <Link
            href="/api/mp/oauth/start"
            className="btn btn-primary mp-connect-btn"
          >
            <i className="ti ti-plug-connected"></i>Conectar
          </Link>

          <div className="mp-help">
            ¿Todavía no tenés cuenta?{" "}
            <a href="https://www.mercadopago.com.ar" target="_blank" rel="noopener">
              Creá una gratis →
            </a>
          </div>
        </div>

        <div className="ob-actions">
          <form action={skipMpAction}>
            <button type="submit" className="btn btn-ghost btn-back">
              Lo hago después
            </button>
          </form>
          <div></div>
        </div>
      </section>
    </ObShell>
  );
}
