import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "~/env";
import { db } from "~/server/db";
import { sendEmail } from "~/server/email";
import { BASE } from "~/server/email-encontrate";
import { puedeUsarHistorias } from "~/server/historias/acceso";

import {
  D,
  SANS,
  antetitulo,
  boton,
  cuerpo,
  esc,
  franjaGris,
  fuerte,
  marco,
  pill,
  texto,
  titular,
} from "./diseno";

/**
 * "¿Ya lo compartiste?": una hora después de que el fotógrafo terminó de subir
 * un evento.
 *
 * Es el momento en que más rinde: las fotos ya están en la tienda y el evento
 * todavía está caliente en el grupo del club. Casi todas las primeras ventas
 * llegan por ahí, por una historia o un mensaje, y el fotógrafo que acaba de
 * subir 800 fotos está pensando en cualquier cosa menos en eso.
 *
 * El mail trae la historia ya armada —la misma que va a encontrar en el
 * estudio—, un mensaje para WhatsApp ya escrito con el link, y la pregunta de
 * dónde lo compartió. La respuesta se anota (AnalyticsEvent EVENT_SHARED):
 * es la única forma de saber si compartir se hace, y por dónde.
 *
 * No es una campaña de las de campanas.ts —ésas son una por cuenta— sino una
 * por EVENTO. Usa el mismo registro de envíos con la clave "compartir:<id del
 * evento>", y la restricción única de EmailEnvio hace lo mismo que allá: dos
 * pasadas cruzadas no mandan dos veces.
 */

export const ID_COMPARTIR = "compartir";
const PREFIJO = `${ID_COMPARTIR}:`;

/** Una hora sin fotos nuevas: la subida terminó. */
const ESPERA_MS = 60 * 60_000;
/**
 * La última foto, hace menos de seis horas. Sin este techo, el día que se
 * prenda le llegaría a cada evento viejo; con él, sólo a los que están
 * terminando ahora. El remitente pasa cada quince minutos, así que seis horas
 * sobran aunque el proceso se reinicie en el medio.
 */
const VENTANA_MS = 6 * 60 * 60_000;
/** Uno por persona cada veinte horas, aunque suba tres eventos el mismo día. */
const ENTRE_MAILS_MS = 20 * 60 * 60_000;

export type Canal = "historia" | "estado" | "whatsapp";
export const CANALES: Record<Canal, string> = {
  historia: "En mis historias",
  estado: "En mi estado",
  whatsapp: "Por WhatsApp",
};

/* ── Firmas ─────────────────────────────────────────────────────────────────
   Igual que la baja: un HMAC del id con el secreto de la app. Ni la imagen de
   la historia ni la respuesta piden sesión —el mail se abre donde sea—, y la
   firma es lo que impide pedir la historia de un evento ajeno o anotarle
   respuestas a otro. */

function firmar(uso: string, eventId: string): string {
  return createHmac("sha256", String(env.AUTH_SECRET ?? "sin-secreto"))
    .update(`${uso}:${eventId}`)
    .digest("hex")
    .slice(0, 32);
}

export function verificar(uso: "historia" | "compartido", eventId: string, firma: string): boolean {
  const esperada = Buffer.from(firmar(uso, eventId));
  const dada = Buffer.from(firma);
  return esperada.length === dada.length && timingSafeEqual(esperada, dada);
}

/** La vista previa de la historia, para el <img> del mail. Termina en .jpg
    para que la CDN la cachee como lo que es. */
export function historiaImgUrl(eventId: string): string {
  return `${BASE}/api/correos/historia/${eventId}/${firmar("historia", eventId)}.jpg`;
}

export function compartidoUrl(eventId: string, canal: Canal, prueba = false): string {
  // En el mail de prueba, tocar una respuesta no anota nada: el evento es de
  // verdad, y la respuesta no.
  return `${BASE}/correos/compartido?e=${encodeURIComponent(eventId)}&c=${canal}&t=${firmar("compartido", eventId)}${prueba ? "&prueba=1" : ""}`;
}

/**
 * La foto de la historia: la procesada más nueva. Es la misma regla con la
 * que el estudio elige la foto de entrada, y tiene que serlo: el mail promete
 * "esta historia", y al tocar el botón tiene que aparecer ésa y no otra.
 */
export async function fotoDeLaHistoria(eventId: string) {
  return db.photo.findFirst({
    where: { eventId, deletedAt: null, previewCleanKey: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { previewCleanKey: true },
  });
}

/* ── A quién le toca ─────────────────────────────────────────────────────── */

type Candidato = {
  eventId: string;
  evento: string;
  fotos: number;
  tienda: string;
  dueno: { id: string; email: string; name: string | null; historiasEnabled: boolean; role: string };
};

function donde(ahora: Date) {
  const hasta = new Date(ahora.getTime() - ESPERA_MS);
  const desde = new Date(ahora.getTime() - VENTANA_MS);
  return {
    isPublished: true,
    NOT: { status: "ARCHIVED" as const },
    owner: {
      role: "PHOTOGRAPHER" as const,
      status: "ACTIVE" as const,
      email: { not: null },
      slug: { not: null },
      onboardingCompletedAt: { not: null },
      // Se puede apagar con la baja, como las campañas: es un consejo, no un
      // aviso de la cuenta.
      emailsPromocionales: true,
      correos: {
        none: {
          campana: { startsWith: PREFIJO },
          createdAt: { gte: new Date(ahora.getTime() - ENTRE_MAILS_MS) },
        },
      },
    },
    AND: [
      // Hubo fotos en la ventana…
      { photos: { some: { createdAt: { gte: desde, lt: hasta } } } },
      // …y ninguna en la última hora, contando las subidas en curso: la fila
      // se crea al firmar la subida, antes de que llegue el archivo.
      { photos: { none: { createdAt: { gte: hasta } } } },
      // …y alguna ya está lista para armar la historia.
      { photos: { some: { deletedAt: null, previewCleanKey: { not: null } } } },
    ],
  };
}

async function candidatos(limite: number, ahora: Date): Promise<Candidato[]> {
  const eventos = await db.event.findMany({
    where: donde(ahora),
    orderBy: { createdAt: "asc" },
    // De más: algunos ya recibieron el suyo, y se descartan abajo.
    take: limite * 3,
    select: {
      id: true,
      name: true,
      slug: true,
      owner: {
        select: { id: true, email: true, name: true, slug: true, historiasEnabled: true, role: true },
      },
      _count: { select: { photos: { where: { deletedAt: null, previewKey: { not: null } } } } },
    },
  });

  // El que ya salió para este evento. No entra en el where porque la clave
  // lleva el id del evento, y Prisma no deja armarla desde la fila.
  const ya = new Set(
    (
      await db.emailEnvio.findMany({
        where: { campana: { in: eventos.map((e) => PREFIJO + e.id) } },
        select: { campana: true },
      })
    ).map((f) => f.campana),
  );

  const vistos = new Set<string>();
  const salida: Candidato[] = [];
  for (const e of eventos) {
    if (ya.has(PREFIJO + e.id) || !e.owner.email || !e.owner.slug) continue;
    // Uno por persona por pasada: el filtro de veinte horas mira lo que ya
    // salió, no lo que está por salir en esta misma vuelta.
    if (vistos.has(e.owner.id)) continue;
    vistos.add(e.owner.id);
    salida.push({
      eventId: e.id,
      evento: e.name,
      fotos: e._count.photos,
      tienda: `${BASE}/${e.owner.slug}/${e.slug}`,
      dueno: {
        id: e.owner.id,
        email: e.owner.email,
        name: e.owner.name,
        historiasEnabled: e.owner.historiasEnabled,
        role: e.owner.role,
      },
    });
    if (salida.length >= limite) break;
  }
  return salida;
}

export async function contarCompartir(ahora = new Date()): Promise<number> {
  return (await candidatos(500, ahora)).length;
}

/* ── El mail ─────────────────────────────────────────────────────────────── */

export type DatosCompartir = {
  nombre: string | null;
  evento: string;
  eventId: string;
  fotos: number;
  tienda: string;
  bajaUrl: string;
  /** Mail de prueba: las respuestas no se anotan. */
  prueba?: boolean;
};

/** El mensaje que el fotógrafo manda al grupo, ya escrito. */
function mensajeWhatsapp(d: DatosCompartir): string {
  return `Ya están las fotos de ${d.evento}. Buscá las tuyas con una selfie o con tu número de dorsal: ${d.tienda}`;
}

export function mailCompartir(d: DatosCompartir): { asunto: string; html: string; texto: string } {
  const nombre = d.nombre?.trim().split(" ")[0];
  const estudio = `${BASE}/dashboard/historias?evento=${encodeURIComponent(d.eventId)}`;
  const wa = `https://wa.me/?text=${encodeURIComponent(mensajeWhatsapp(d))}`;
  const fotos = `${d.fotos.toLocaleString("es-AR")} ${d.fotos === 1 ? "foto" : "fotos"}`;

  /* La historia y su botón, lado a lado en escritorio y una abajo de la otra
     en el teléfono. Es la técnica "híbrida": dos bloques inline-block que se
     apilan solos cuando no entran, y una tabla sólo para Outlook, que no
     entiende inline-block. */
  const historia = `
<!--[if mso]><table role="presentation" width="488" cellpadding="0" cellspacing="0" border="0"><tr><td width="200" valign="top"><![endif]-->
<div style="display:inline-block;width:100%;max-width:200px;vertical-align:top;"><a href="${estudio}" style="text-decoration:none;"><img src="${historiaImgUrl(d.eventId)}" width="200" height="356" alt="La historia de ${esc(d.evento)}, lista para publicar" style="display:block;width:200px;max-width:100%;height:auto;border:1px solid ${D.linea};border-radius:14px;font-family:${SANS};font-size:13px;color:${D.tenue};" /></a></div><!--[if mso]></td><td width="288" valign="top"><![endif]--><div style="display:inline-block;width:100%;max-width:280px;vertical-align:top;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:18px 0 0 24px;" class="en-hist">
    <div style="font-family:${SANS};font-weight:500;font-size:10.5px;letter-spacing:0.2em;text-transform:uppercase;color:${D.tenue};padding-bottom:10px;">Te la armamos</div>
    <div style="font-family:${SANS};font-weight:600;font-size:18px;line-height:24px;color:${D.tinta};padding-bottom:8px;">Una foto del evento, tu marca y el link a la tienda.</div>
    <div style="font-family:${SANS};font-size:14px;line-height:21px;color:${D.cordon};padding-bottom:20px;">Elegís otra foto si querés, la bajás y la subís a tus historias de Instagram y a tu estado de WhatsApp.</div>
    ${boton("Crear mi historia", estudio)}
  </td></tr></table>
</div>
<!--[if mso]></td></tr></table><![endif]-->`;

  const grupo = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
  <td valign="middle" style="padding:0 16px 0 0;">
    <div style="font-family:${SANS};font-weight:600;font-size:15px;line-height:20px;color:${D.tinta};">¿Y el grupo del club?</div>
    <div style="font-family:${SANS};font-size:13.5px;line-height:19px;color:${D.tenue};padding-top:2px;">El mensaje ya va escrito, con el link. Elegís a quién.</div>
  </td>
  <td valign="middle" align="right" style="white-space:nowrap;">${boton("WhatsApp", wa, D.whatsapp)}</td>
</tr></table>`;

  const pregunta = `
<div style="height:1px;line-height:1px;font-size:0;background:${D.lineaSuave};margin:22px 0 20px;">&nbsp;</div>
<div style="font-family:${SANS};font-weight:600;font-size:15px;line-height:20px;color:${D.tinta};padding-bottom:4px;">¿Ya lo hiciste?</div>
<div style="font-family:${SANS};font-size:13.5px;line-height:19px;color:${D.tenue};padding-bottom:12px;">Tocá dónde y lo anotamos. Nos sirve para saber qué funciona.</div>
<div>${(Object.keys(CANALES) as Canal[]).map((c) => pill(CANALES[c], compartidoUrl(d.eventId, c, d.prueba))).join("")}</div>`;

  const html = marco({
    titulo: "¿Ya lo compartiste?",
    preheader: `Tus ${fotos} de ${d.evento} ya están en la tienda. Una historia y un mensaje al grupo: de ahí salen las primeras ventas.`,
    rotulo: "Compartir",
    tarjeta:
      cuerpo(
        `${antetitulo(`${d.evento} · ${fotos} en la tienda`)}
        ${titular(nombre ? `${nombre}, ¿ya lo compartiste?` : "¿Ya lo compartiste?")}
        ${texto(`Las fotos de ${fuerte(d.evento)} ya están en tu tienda. Las primeras ventas casi siempre llegan igual: alguien ve una historia o un mensaje en el grupo y va a buscar las suyas.`)}
        ${historia}`,
        36,
      ) + franjaGris(grupo + pregunta),
    pie: `Te escribimos una hora después de que terminaste de subir fotos. Si no querés estos consejos, <a href="${d.bajaUrl}" style="color:${D.tenue};text-decoration:underline;">date de baja acá</a>.`,
  });

  const textoPlano = `${nombre ? `${nombre}, ¿` : "¿"}ya lo compartiste?

Las fotos de ${d.evento} ya están en tu tienda (${fotos}). Las primeras ventas casi siempre llegan igual: alguien ve una historia o un mensaje en el grupo y va a buscar las suyas.

Te armamos la historia, con una foto del evento, tu marca y el link: ${estudio}

Para el grupo del club, el mensaje ya escrito: ${wa}

¿Ya lo hiciste? Contanos dónde:
${(Object.keys(CANALES) as Canal[]).map((c) => `- ${CANALES[c]}: ${compartidoUrl(d.eventId, c, d.prueba)}`).join("\n")}

—
Te escribimos una hora después de que terminaste de subir fotos. Para no recibir más estos consejos: ${d.bajaUrl}`;

  return { asunto: `¿Ya compartiste ${d.evento}?`, html, texto: textoPlano };
}

/* ── Enviar ─────────────────────────────────────────────────────────────── */

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function enviarCompartir(
  limite: number,
  bajaUrl: (userId: string) => string,
  ahora = new Date(),
): Promise<{ enviados: number; fallidos: number }> {
  let enviados = 0;
  let fallidos = 0;

  for (const c of await candidatos(limite, ahora)) {
    // El reclamo primero, como en las campañas: si otra pasada llegó antes,
    // la restricción única lo frena acá.
    let fila: { id: string };
    try {
      fila = await db.emailEnvio.create({
        data: { userId: c.dueno.id, campana: PREFIJO + c.eventId },
        select: { id: true },
      });
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") continue;
      throw e;
    }

    try {
      /* El botón lleva al estudio: si al tocarlo diera 404, el mail sería
         peor que no mandarlo. Si la cuenta no lo tiene, se le habilita, como
         hace la campaña de historias. */
      if (!(await puedeUsarHistorias(c.dueno))) {
        await db.user.update({ where: { id: c.dueno.id }, data: { historiasEnabled: true } });
      }
      const mail = mailCompartir({
        nombre: c.dueno.name,
        evento: c.evento,
        eventId: c.eventId,
        fotos: c.fotos,
        tienda: c.tienda,
        bajaUrl: bajaUrl(c.dueno.id),
      });
      const r = await sendEmail({ to: c.dueno.email, subject: mail.asunto, html: mail.html, text: mail.texto });
      if (!r) {
        await db.emailEnvio.delete({ where: { id: fila.id } }).catch(() => undefined);
        console.warn("[correos] compartir: sin proveedor configurado, se detiene");
        return { enviados, fallidos };
      }
      await db.emailEnvio.update({ where: { id: fila.id }, data: { resendId: r.id } });
      enviados++;
      console.log(`[correos] compartir evento=${c.eventId} resend=${r.id}`);
    } catch (e) {
      await db.emailEnvio.delete({ where: { id: fila.id } }).catch(() => undefined);
      fallidos++;
      console.error(`[correos] compartir evento=${c.eventId} falló:`, e);
    }

    await dormir(400);
  }

  return { enviados, fallidos };
}

/**
 * El mail a una dirección, sin registrarlo. Para verlo antes de prenderlo.
 * Con el último evento publicado de quien lo pide, o el último de la
 * plataforma si no tiene ninguno: hace falta un evento de verdad para que la
 * historia de la vista previa sea una historia de verdad.
 */
export async function enviarPruebaCompartir(
  to: string,
  userId: string,
  nombre: string | null,
): Promise<string | null> {
  const conFotos = {
    isPublished: true,
    photos: { some: { deletedAt: null, previewCleanKey: { not: null } } },
  };
  const elegir = { name: true, id: true, slug: true, owner: { select: { slug: true } } } as const;
  const ev =
    (await db.event.findFirst({ where: { ...conFotos, ownerId: userId }, orderBy: { createdAt: "desc" }, select: elegir })) ??
    (await db.event.findFirst({ where: conFotos, orderBy: { createdAt: "desc" }, select: elegir }));
  if (!ev) return null;

  const fotos = await db.photo.count({ where: { eventId: ev.id, deletedAt: null, previewKey: { not: null } } });
  const mail = mailCompartir({
    nombre,
    evento: ev.name,
    eventId: ev.id,
    fotos,
    tienda: `${BASE}/${ev.owner.slug ?? ""}/${ev.slug}`,
    bajaUrl: `${BASE}/correos/baja?prueba=1`,
    prueba: true,
  });
  const r = await sendEmail({ to, subject: `[prueba] ${mail.asunto}`, html: mail.html, text: mail.texto });
  return r?.id ?? null;
}
