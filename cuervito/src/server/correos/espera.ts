import "server-only";

import { urlPublica } from "~/lib/url-publica";
import { db } from "~/server/db";
import { sendEmail } from "~/server/email";

import { antetitulo, BASE, boton, cuerpo, fuerte, marco, texto, titular } from "./diseno";

/**
 * Los dos mails de un evento que todavía no está publicado.
 *
 * 1. Al FOTÓGRAFO, cuando alguien entra al link y toca «avisarle»: alguien
 *    quiere esas fotos y no las puede comprar. Uno por evento por día, como
 *    mucho; el botón lo puede tocar cualquiera, y sin tope serviría para
 *    llenarle la casilla a alguien.
 *
 * 2. A quien dejó su mail, cuando el fotógrafo publica: «ya están». Uno solo
 *    por persona y por evento (EsperaEvento lo garantiza en la base).
 *
 * Los de (2) los manda el remitente de correos en cada pasada, no el botón de
 * publicar: así un reinicio a mitad del envío no los pierde, la próxima pasada
 * retoma los que quedaron. Publicar sólo empuja una pasada antes de tiempo.
 */

/** Fecha en Argentina, para la clave de «uno por día». */
function hoyAR(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
}

/* ── 1) Al fotógrafo ─────────────────────────────────────────────────────── */

export function pedidoPublicacionHtml(i: { evento: string; eventId: string; esperando: number }): {
  asunto: string;
  html: string;
  texto: string;
} {
  const quienes =
    i.esperando === 0
      ? "Si lo publicás ahora, lo encuentran."
      : i.esperando === 1
        ? `${fuerte("Una persona")} dejó su mail: le escribimos apenas lo publiques.`
        : `${fuerte(`${i.esperando} personas`)} dejaron su mail: les escribimos apenas lo publiques.`;
  const url = `${BASE}/dashboard/evento/${i.eventId}`;

  return {
    asunto: `Quieren ver las fotos de ${i.evento}`,
    html: marco({
      titulo: `Quieren ver las fotos de ${i.evento}`,
      preheader: "Entraron al link y el evento todavía no está publicado.",
      rotulo: "Tu evento",
      tarjeta: cuerpo(
        `${antetitulo("Evento sin publicar")}
        ${titular(`Alguien quiere las fotos de ${i.evento}.`)}
        ${texto(`Entraron al link del evento y todavía no está publicado, así que no las pueden comprar. ${quienes}`)}
        ${boton("Publicar el evento", url)}`,
      ),
      pie: "Te escribimos como mucho una vez por día por evento, y sólo cuando alguien lo pide desde la página.",
    }),
    texto: `Alguien quiere las fotos de ${i.evento}. Entraron al link y todavía no está publicado. Publicalo acá: ${url}`,
  };
}

/**
 * Le avisa al dueño del evento. Devuelve si salió el mail: `false` también
 * cuando ya se le avisó hoy, que no es un error.
 *
 * Usa EmailEnvio con la clave "pedido:<evento>:<día>": la restricción única
 * (persona, clave) es la que hace que dos visitas del mismo día no manden dos.
 */
export async function avisarAlFotografo(eventId: string): Promise<boolean> {
  const ev = await db.event.findUnique({
    where: { id: eventId },
    select: {
      name: true,
      ownerId: true,
      owner: { select: { email: true, status: true } },
      _count: { select: { esperas: { where: { avisadoAt: null } } } },
    },
  });
  if (!ev?.owner.email || ev.owner.status !== "ACTIVE") return false;

  let fila: { id: string };
  try {
    fila = await db.emailEnvio.create({
      data: { userId: ev.ownerId, campana: `pedido:${eventId}:${hoyAR()}` },
      select: { id: true },
    });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") return false;
    throw e;
  }

  try {
    const mail = pedidoPublicacionHtml({ evento: ev.name, eventId, esperando: ev._count.esperas });
    const r = await sendEmail({ to: ev.owner.email, subject: mail.asunto, html: mail.html, text: mail.texto });
    if (!r) {
      await db.emailEnvio.delete({ where: { id: fila.id } }).catch(() => undefined);
      return false;
    }
    await db.emailEnvio.update({ where: { id: fila.id }, data: { resendId: r.id } });
    return true;
  } catch (e) {
    // Se libera el reclamo: si alguien vuelve a tocar el botón, se reintenta.
    await db.emailEnvio.delete({ where: { id: fila.id } }).catch(() => undefined);
    throw e;
  }
}

/* ── 2) A quien esperaba ─────────────────────────────────────────────────── */

export function eventoPublicadoHtml(i: {
  evento: string;
  fotografo: string;
  url: string;
  conBusqueda: boolean;
}): { asunto: string; html: string; texto: string } {
  const como = i.conBusqueda
    ? "Entrá y buscate con tu número de dorsal o con una selfie: ves sólo las tuyas."
    : "Entrá y recorré la galería: elegís las tuyas y las bajás al instante.";
  return {
    asunto: `Ya están las fotos de ${i.evento}`,
    html: marco({
      titulo: `Ya están las fotos de ${i.evento}`,
      preheader: `${i.fotografo} publicó las fotos. Buscate y descargalas al instante.`,
      rotulo: "Tus fotos",
      tarjeta: cuerpo(
        `${antetitulo(`Fotos de ${i.fotografo}`)}
        ${titular(`Ya están las fotos de ${i.evento}.`)}
        ${texto(`Pediste que te avisemos cuando se publicaran. ${como} No hace falta crear cuenta.`)}
        ${boton("Buscar mis fotos", i.url)}`,
      ),
      pie: "Te escribimos porque dejaste tu mail en la página del evento. Es el único mail que te vamos a mandar por esto.",
    }),
    texto: `Ya están las fotos de ${i.evento}, de ${i.fotografo}. ${como} ${i.url}`,
  };
}

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Un reclamo sin resendId más viejo que esto es un envío que se cortó a la
 * mitad (el proceso se reinició entre reclamar y mandar). Se libera para que
 * se vuelva a intentar. El riesgo es el inverso —que el mail haya salido y
 * sólo faltara anotarlo— y es mucho más chico: un mail repetido contra uno
 * que no llega nunca.
 */
const RECLAMO_COLGADO_MS = 15 * 60_000;

/** Una pasada: escribe a quienes esperaban un evento que ya se publicó. */
export async function avisarPublicados(
  limite: number,
  entreEnvios = 400,
): Promise<{ enviados: number; fallidos: number }> {
  await db.esperaEvento.updateMany({
    where: { resendId: null, avisadoAt: { lt: new Date(Date.now() - RECLAMO_COLGADO_MS) } },
    data: { avisadoAt: null },
  });

  const pendientes = await db.esperaEvento.findMany({
    where: {
      avisadoAt: null,
      event: {
        isPublished: true,
        NOT: { status: "ARCHIVED" },
        owner: { status: "ACTIVE" },
      },
    },
    orderBy: { createdAt: "asc" },
    take: limite,
    select: {
      id: true,
      email: true,
      event: {
        select: {
          name: true,
          slug: true,
          recognition: true,
          owner: {
            select: {
              name: true,
              slug: true,
              customDomains: {
                where: { status: "ACTIVE" },
                orderBy: { verifiedAt: "asc" },
                take: 1,
                select: { hostname: true },
              },
            },
          },
        },
      },
    },
  });

  let enviados = 0;
  let fallidos = 0;

  for (const p of pendientes) {
    const { event: ev } = p;
    if (!ev.owner.slug) continue;

    // El reclamo: si otra pasada ya lo tomó, count es 0 y se sigue.
    const reclamo = await db.esperaEvento.updateMany({
      where: { id: p.id, avisadoAt: null },
      data: { avisadoAt: new Date() },
    });
    if (reclamo.count === 0) continue;

    try {
      const mail = eventoPublicadoHtml({
        evento: ev.name,
        fotografo: ev.owner.name ?? "El fotógrafo",
        url: urlPublica(ev.owner.slug, ev.owner.customDomains[0]?.hostname, ev.slug),
        conBusqueda: ev.recognition,
      });
      const r = await sendEmail({ to: p.email, subject: mail.asunto, html: mail.html, text: mail.texto });
      if (!r) {
        // Sin proveedor configurado: no salió nada, y no va a salir el resto.
        await db.esperaEvento.update({ where: { id: p.id }, data: { avisadoAt: null } });
        break;
      }
      await db.esperaEvento.update({ where: { id: p.id }, data: { resendId: r.id } });
      enviados++;
    } catch (e) {
      await db.esperaEvento
        .update({ where: { id: p.id }, data: { avisadoAt: null } })
        .catch(() => undefined);
      fallidos++;
      console.error(`[correos] publicado → ${p.email} falló:`, e);
    }

    await dormir(entreEnvios);
  }

  return { enviados, fallidos };
}
