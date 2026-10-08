import "server-only";

import { db } from "~/server/db";
import { sendEmail } from "~/server/email";

import { antetitulo, BASE, boton, cuerpo, esc, fuerte, marco, sinLink, texto, titular } from "./diseno";

/**
 * El mail al fotógrafo cuando alguien le escribe desde un portfolio.
 *
 * Todo lo que llega del visitante —nombre, mail, mensaje— va escapado: es
 * texto de un desconocido metido en un HTML que abre el fotógrafo. Y el mail
 * del visitante va como Reply-To, no como remitente: el remitente es siempre
 * el nuestro (si no, el proveedor lo rechaza o cae en spam).
 */
export function consultaPortfolioHtml(i: {
  portfolio: string;
  portfolioId: string;
  nombre: string;
  email: string;
  mensaje: string;
}): { asunto: string; html: string; texto: string } {
  const url = `${BASE}/dashboard/portfolio/${i.portfolioId}?pestana=consultas`;
  // sinLink: que el cliente de correo no convierta en enlace lo que escribió
  // el visitante (un "visitá ejemplo.com" en el mensaje).
  const mensaje = sinLink(esc(i.mensaje)).replace(/\n/g, "<br/>");
  return {
    asunto: `${i.nombre} te escribió desde tu portfolio`,
    html: marco({
      titulo: `${i.nombre} te escribió desde tu portfolio`,
      preheader: i.mensaje.slice(0, 90),
      rotulo: "Tu portfolio",
      tarjeta: cuerpo(
        `${antetitulo(i.portfolio)}
        ${titular(`${i.nombre} te escribió.`)}
        ${texto(mensaje)}
        ${texto(`Respondé este mail y le llega a ${fuerte(i.email)}.`, 24)}
        ${boton("Ver tus consultas", url)}`,
      ),
      pie: "Te llega un mail por cada consulta. También las ves en el panel, en tu portfolio.",
    }),
    texto: `${i.nombre} (${i.email}) te escribió desde ${i.portfolio}:\n\n${i.mensaje}\n\nTus consultas: ${url}`,
  };
}

/** Le avisa al dueño. Si falla, la consulta igual quedó guardada en el panel. */
export async function avisarConsulta(consultaId: string): Promise<void> {
  const c = await db.consultaPortfolio.findUnique({
    where: { id: consultaId },
    select: {
      nombre: true,
      email: true,
      mensaje: true,
      portfolio: { select: { id: true, nombre: true, owner: { select: { email: true, status: true } } } },
    },
  });
  const dueno = c?.portfolio.owner;
  if (!c || !dueno?.email || dueno.status !== "ACTIVE") return;
  const mail = consultaPortfolioHtml({
    portfolio: c.portfolio.nombre,
    portfolioId: c.portfolio.id,
    nombre: c.nombre,
    email: c.email,
    mensaje: c.mensaje,
  });
  await sendEmail({ to: dueno.email, subject: mail.asunto, html: mail.html, text: mail.texto, replyTo: c.email });
}
