import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "~/server/auth";
import { db } from "~/server/db";

import { acceptCollaboratorInvite } from "./actions";

export default async function InvitationPage(props: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await props.params;
  const session = await auth();

  const invite = await db.eventCollaborator.findUnique({
    where: { inviteToken: token },
    include: {
      event: {
        select: { name: true, slug: true, coverUrl: true },
      },
      invitedBy: {
        select: { name: true, slug: true },
      },
    },
  });

  if (!invite) {
    return (
      <main className="wrap-narrower">
        <div className="head">
          <h1>Invitación no encontrada</h1>
          <div className="sub">
            El link puede estar vencido o haber sido revocado.
          </div>
        </div>
        <Link href="/" className="btn btn-outline">
          Volver al inicio
        </Link>
      </main>
    );
  }

  if (invite.status === "REVOKED") {
    return (
      <main className="wrap-narrower">
        <div className="head">
          <h1>Invitación revocada</h1>
          <div className="sub">
            El fotógrafo host revocó esta invitación. Contactalo si esperabas
            acceso a {invite.event.name}.
          </div>
        </div>
      </main>
    );
  }

  if (invite.status === "ACCEPTED") {
    return (
      <main className="wrap-narrower">
        <div className="head">
          <h1>Ya aceptaste esta invitación</h1>
          <div className="sub">
            Ya sos colaborador de {invite.event.name}.
          </div>
        </div>
        <Link href="/dashboard/events" className="btn btn-primary">
          Ir al panel
        </Link>
      </main>
    );
  }

  // No hay sesión: mandar a login/signup con callbackUrl al accept.
  if (!session?.user?.id) {
    const callback = `/invitacion/${token}`;
    return (
      <main className="wrap-narrower">
        <div className="head">
          <h1>Te invitaron a colaborar</h1>
          <div className="sub">
            <strong>{invite.invitedBy.name ?? "Un fotógrafo"}</strong> te invitó a
            colaborar en <strong>{invite.event.name}</strong>. Ingresá o creá tu
            cuenta con el email <strong>{invite.invitedEmail}</strong> para
            aceptar.
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Link
            href={`/login?callbackUrl=${encodeURIComponent(callback)}&email=${encodeURIComponent(invite.invitedEmail)}`}
            className="btn btn-primary btn-lg"
          >
            Iniciar sesión
          </Link>
          <Link
            href={`/signup?callbackUrl=${encodeURIComponent(callback)}&email=${encodeURIComponent(invite.invitedEmail)}`}
            className="btn btn-outline btn-lg"
          >
            Crear cuenta
          </Link>
        </div>
      </main>
    );
  }

  // Hay sesión pero con email distinto al invitado.
  const sessionEmail = session.user.email?.toLowerCase();
  if (sessionEmail !== invite.invitedEmail.toLowerCase()) {
    return (
      <main className="wrap-narrower">
        <div className="head">
          <h1>Email no coincide</h1>
          <div className="sub">
            Estás logueado como <strong>{sessionEmail}</strong>, pero la
            invitación es para <strong>{invite.invitedEmail}</strong>. Cerrá
            sesión y volvé a entrar con ese email para aceptar.
          </div>
        </div>
      </main>
    );
  }

  // Verifica que tenga MP conectado.
  const me = await db.user.findUnique({
    where: { id: session.user.id },
    select: { mpConnectedAt: true },
  });
  if (!me?.mpConnectedAt) {
    redirect(`/onboarding/mp?callbackUrl=${encodeURIComponent(`/invitacion/${token}`)}`);
  }

  return (
    <main className="wrap-narrower">
      <div className="head">
        <h1>Aceptar invitación</h1>
        <div className="sub">
          <strong>{invite.invitedBy.name ?? "Un fotógrafo"}</strong> te invitó a
          colaborar en <strong>{invite.event.name}</strong>.
        </div>
      </div>

      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 14,
          padding: "22px 24px",
          marginBottom: 22,
        }}
      >
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <i
            className="ti ti-percentage"
            style={{ color: "var(--accent)", fontSize: 22, marginTop: 2 }}
          />
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>
              Comisión pactada:
            </div>
            <div style={{ color: "var(--text-secondary)" }}>
              {invite.commissionScope === "NONE"
                ? "Sin comisión — colaborás como uploader."
                : invite.commissionScope === "OWN"
                  ? `${invite.commissionPct}% sobre las ventas de las fotos que subas.`
                  : `${invite.commissionPct}% sobre todas las ventas del evento.`}
            </div>
          </div>
        </div>
      </div>

      <form action={acceptCollaboratorInvite}>
        <input type="hidden" name="token" value={token} />
        <div style={{ display: "flex", gap: 10 }}>
          <button type="submit" className="btn btn-primary btn-lg">
            <i className="ti ti-check" />
            Aceptar y colaborar
          </button>
          <Link href="/dashboard" className="btn btn-ghost">
            Ahora no
          </Link>
        </div>
      </form>
    </main>
  );
}
