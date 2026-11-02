import { type Metadata } from "next";
import Link from "next/link";
import { CircleCheck, Link2Off, MailX, UserX, Users } from "lucide-react";

import "~/styles/auth-invitacion.css";

import { env } from "~/env";
import { auth } from "~/server/auth";
import { db } from "~/server/db";

import { Estado, Marco } from "../../_piezas";
import { acceptCollaboratorInvite, cambiarDeCuenta } from "./actions";

export const metadata: Metadata = { robots: { index: false, follow: false } };

type Alcance = "NONE" | "OWN" | "ALL";

/**
 * Aceptar una invitación a cubrir un evento.
 *
 * Es la quinta pantalla de autenticación y no una página suelta: quien llega
 * acá viene de un mail, casi siempre sin sesión, y lo primero que hace es
 * entrar o crear la cuenta. Por eso vive en el mismo grupo que el ingreso y
 * usa su armazón. Antes estaba afuera, con clases de un CSS que ninguna ruta
 * cargaba, y se veía como texto suelto sobre blanco.
 *
 * No pide Mercado Pago: la venta entra siempre en la cuenta del dueño del
 * evento y el colaborador cobra de él.
 */
export default async function InvitationPage(props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;
  const [session, invite] = await Promise.all([
    auth(),
    db.eventCollaborator.findUnique({
      where: { inviteToken: token },
      select: {
        eventId: true,
        status: true,
        userId: true,
        invitedEmail: true,
        commissionScope: true,
        commissionPct: true,
        event: { select: { name: true, platformFeePct: true } },
        invitedBy: { select: { name: true } },
      },
    }),
  ]);

  if (!invite) {
    return (
      <Marco lado={lado(0, "NONE")}>
        <Estado
          tono="mal"
          icono={<Link2Off />}
          titulo="Este link no abre nada"
          bajada="Puede estar mal copiado, o la invitación se canceló. Pedile una nueva a quien te invitó."
        >
          <div className="estado-acc">
            <Link href="/" className="btn btn-ghost btn-lg btn-block">
              Ir al inicio
            </Link>
          </div>
        </Estado>
      </Marco>
    );
  }

  // Un nombre vacío cuenta como ninguno: «te invita» sin nadie adelante.
  const nombre = invite.invitedBy.name?.trim() ?? "";
  const quien = nombre || "Un fotógrafo";
  const deQuien = nombre || "quien te invita";
  const evento = invite.event.name;
  const comision =
    invite.event.platformFeePct !== null ? Number(invite.event.platformFeePct) : env.PLATFORM_FEE_PERCENT;
  const yo = session?.user?.id ?? null;
  const miMail = session?.user?.email?.toLowerCase() ?? null;
  const callback = `/invitacion/${token}`;
  const conMail = (ruta: "/login" | "/signup") =>
    `${ruta}?callbackUrl=${encodeURIComponent(callback)}&email=${encodeURIComponent(invite.invitedEmail)}`;
  const costado = lado(invite.commissionPct, invite.commissionScope);

  if (invite.status === "REVOKED") {
    return (
      <Marco lado={costado}>
        <Estado
          tono="mal"
          icono={<UserX />}
          titulo="Se canceló"
          bajada={
            <>
              {quien} canceló la invitación a <b>{evento}</b>. Si esperabas entrar, escribile.
            </>
          }
        >
          <div className="estado-acc">
            <Link href="/" className="btn btn-ghost btn-lg btn-block">
              Ir al inicio
            </Link>
          </div>
        </Estado>
      </Marco>
    );
  }

  if (invite.status === "ACCEPTED") {
    const esMia = yo !== null && invite.userId === yo;
    return (
      <Marco lado={costado} volverA={esMia ? "/dashboard" : "/"}>
        <Estado
          icono={<CircleCheck />}
          titulo="Ya estás adentro"
          bajada={
            esMia ? (
              <>
                Aceptaste la invitación de {quien} a <b>{evento}</b>. El evento ya está en tu panel.
              </>
            ) : (
              <>
                Esta invitación a <b>{evento}</b> ya la aceptó otra cuenta. Entrá con ella para ver el
                evento.
              </>
            )
          }
        >
          {!esMia && <div className="estado-dato">{invite.invitedEmail}</div>}
          <div className="estado-acc">
            {esMia ? (
              <Link href={`/dashboard/evento/${invite.eventId}`} className="btn btn-pri btn-lg btn-block">
                Ir al evento
              </Link>
            ) : (
              <Link
                href={`/login?callbackUrl=${encodeURIComponent(`/dashboard/evento/${invite.eventId}`)}&email=${encodeURIComponent(invite.invitedEmail)}`}
                className="btn btn-pri btn-lg btn-block"
              >
                Iniciar sesión
              </Link>
            )}
          </div>
        </Estado>
      </Marco>
    );
  }

  // Sin sesión: a entrar o a crear la cuenta, y de ahí de vuelta acá. Si el
  // mail ya tiene cuenta, entrar va primero; si no, crearla.
  if (!yo) {
    const tieneCuenta = invite.userId !== null;
    const entrar = (
      <Link href={conMail("/login")} className={`btn ${tieneCuenta ? "btn-pri" : "btn-ghost"} btn-lg btn-block`}>
        Iniciar sesión
      </Link>
    );
    const crear = (
      <Link href={conMail("/signup")} className={`btn ${tieneCuenta ? "btn-ghost" : "btn-pri"} btn-lg btn-block`}>
        Crear mi cuenta
      </Link>
    );
    return (
      <Marco lado={costado}>
        <h1>
          Te invitaron
          <br />
          a cubrir un evento
        </h1>
        <p className="auth-sub">
          {quien} te invita a subir tus fotos a <b>{evento}</b>. Para aceptar, entrá o creá tu cuenta con
          el mail de la invitación:
        </p>
        <div className="estado-dato">{invite.invitedEmail}</div>
        <Trato alcance={invite.commissionScope} pct={invite.commissionPct} comision={comision} deQuien={deQuien} />
        <div className="estado-acc">
          {tieneCuenta ? entrar : crear}
          {tieneCuenta ? crear : entrar}
        </div>
      </Marco>
    );
  }

  // Hay sesión, pero no es la del mail invitado.
  if (miMail !== invite.invitedEmail.toLowerCase()) {
    return (
      <Marco lado={costado} volverA="/dashboard">
        <Estado
          tono="mal"
          icono={<MailX />}
          titulo="Es para otro mail"
          bajada={
            <>
              Estás con <b>{miMail}</b>. La invitación de {quien} es para:
            </>
          }
        >
          <div className="estado-dato">{invite.invitedEmail}</div>
          <div className="estado-nota">
            Cambiá de cuenta y entrá con ese mail. Si preferís usar esta, pedile a {quien} que te invite a{" "}
            <b>{miMail}</b>.
          </div>
          <form action={cambiarDeCuenta} className="estado-acc">
            <input type="hidden" name="token" value={token} />
            <button type="submit" className="btn btn-pri btn-lg btn-block">
              Cambiar de cuenta
            </button>
            <Link href="/dashboard" className="btn btn-ghost btn-lg btn-block">
              Ir a mi panel
            </Link>
          </form>
        </Estado>
      </Marco>
    );
  }

  return (
    <Marco lado={costado} volverA="/dashboard">
      <h1>
        Aceptá la
        <br />
        invitación
      </h1>
      <p className="auth-sub">
        {quien} te invita a subir tus fotos a <b>{evento}</b>. Van a la misma tienda, y las tuyas quedan
        a tu nombre.
      </p>
      <Trato alcance={invite.commissionScope} pct={invite.commissionPct} comision={comision} deQuien={deQuien} />
      <form action={acceptCollaboratorInvite} className="estado-acc">
        <input type="hidden" name="token" value={token} />
        <button type="submit" className="btn btn-pri btn-lg btn-block">
          Aceptar y entrar al evento
        </button>
        <Link href="/dashboard" className="btn btn-ghost btn-lg btn-block">
          Ahora no
        </Link>
      </form>
    </Marco>
  );
}

/**
 * Lo pactado, en una tarjeta: la misma frase que vio en el mail. Y lo que
 * pasa con la plata dicho acá, no descubierto al cobrar: la venta entra en
 * el Mercado Pago de quien invita, y de ahí se la pasa.
 */
function Trato({
  alcance,
  pct,
  comision,
  deQuien,
}: {
  alcance: Alcance;
  pct: number;
  comision: number;
  deQuien: string;
}) {
  if (alcance === "NONE" || pct === 0) {
    return (
      <>
        <div className="inv-trato">
          <div className="inv-cifra">
            <Users />
          </div>
          <div className="inv-trato-t">
            <b>Sin comisión</b>
            <span>Colaborás subiendo fotos al evento.</span>
          </div>
        </div>
        <p className="inv-nota">
          Las ventas entran en el Mercado Pago de <b>{deQuien}</b>.
        </p>
      </>
    );
  }
  return (
    <>
      <div className="inv-trato">
        <div className="inv-cifra">{pct}%</div>
        <div className="inv-trato-t">
          <b>{alcance === "OWN" ? "de lo que vendan tus fotos" : "de todas las ventas del evento"}</b>
          <span>Después del {comision}% de encontrate, venta por venta.</span>
        </div>
      </div>
      <p className="inv-nota">
        Las ventas entran en el Mercado Pago de <b>{deQuien}</b>. Lo tuyo queda anotado en el evento y te
        lo pasa esa persona.
      </p>
    </>
  );
}

/** El texto de la columna de la foto, con lo pactado como cifra si lo hay. */
function lado(pct: number, alcance: Alcance): { texto: string; datos: [string, string][] } {
  const equipo: [string, string] = ["1", "tienda para todo el equipo"];
  return {
    texto:
      "Subís tus fotos al evento de otro fotógrafo, a la misma tienda. Lo que vendan las tuyas queda anotado a tu nombre.",
    datos:
      alcance !== "NONE" && pct > 0
        ? [[`${pct}%`, alcance === "OWN" ? "de tus fotos, para vos" : "de todas las ventas"], equipo]
        : [equipo, ["24 hs", "de soporte"]],
  };
}
