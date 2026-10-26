import { type Metadata } from "next";
import Link from "next/link";

import { auth } from "~/server/auth";
import { db } from "~/server/db";

import { acceptCollaboratorInvite } from "./actions";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Aceptar una invitación a cubrir un evento.
 *
 * Ya no pide Mercado Pago. La venta entra siempre en la cuenta del dueño del
 * evento y el colaborador cobra de él, así que pedirle que conecte la suya
 * era un resto del modelo anterior: una puerta cerrada para alguien que
 * viene a subir fotos, y una promesa falsa de que iba a cobrar por ahí.
 */
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
        <Link href={`/dashboard/evento/${invite.eventId}`} className="btn btn-primary">
          Ir al evento
        </Link>
      </main>
    );
  }

  // No hay sesión: a entrar o a crear la cuenta, y de ahí de vuelta acá.
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
            {/* Dicho acá y no descubierto al cobrar: la plata entra en la
                cuenta de quien invita, y de ahí se la pasa. */}
            <div style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 8 }}>
              Las ventas entran en el Mercado Pago de {invite.invitedBy.name ?? "quien te invita"}.
              Lo tuyo queda anotado en el panel y te lo pasa esa persona.
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
