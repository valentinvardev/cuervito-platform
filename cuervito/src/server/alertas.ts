import "server-only";

import { env } from "~/env";
import {
  BASE,
  D,
  SANS,
  antetitulo,
  boton,
  cuerpo,
  esc,
  franjaGris,
  marco,
  texto,
} from "~/server/correos/diseno";
import { db } from "~/server/db";
import { sendEmail } from "~/server/email";

/**
 * Avisos al equipo cuando la plataforma deja de hacer lo que promete.
 *
 * Nacen en noviembre de 2026. La credencial de Mercado Pago de un fotógrafo
 * venció, y durante días cada compra en su tienda falló al iniciar el pago.
 * El error estaba en el log de pm2 desde la primera. Un log que nadie mira es
 * lo mismo que nada, y el que avisó fue él.
 *
 * Qué es una alerta acá: algo que necesita que una persona haga algo hoy. No
 * es una métrica ni un resumen; para eso está el panel. Por eso va por mail, y
 * por eso la misma clave no vuelve a sonar hasta que pasen `cadaMin` minutos:
 * cincuenta mails iguales son peores que uno, porque al tercero se dejan
 * de leer.
 *
 * El destino es ALERTAS_EMAIL. Sin esa variable el aviso queda en el log, como
 * hasta ahora. Y mandar la alerta nunca puede ser lo que tire al que avisa:
 * alertar() no lanza, devuelve qué pasó.
 */

const CADA_MIN = 60;
const ZONA = "America/Argentina/Buenos_Aires";

export type Alerta = {
  /** Qué problema es, no qué instancia: dos compras fallidas en la misma
   *  tienda son la misma clave. El silencio es por clave. */
  clave: string;
  asunto: string;
  /** Oraciones sueltas, en texto plano; cada una es un párrafo. */
  lineas: string[];
  /** El error tal cual, para pegarlo en una búsqueda. */
  detalle?: string;
  link?: { texto: string; url: string };
  /** Cuánto silencio después de mandarla. */
  cadaMin?: number;
};

export type ResultadoAlerta = "enviada" | "silenciada" | "sin-destino" | "fallo";

export function alertasConfiguradas(): boolean {
  return !!env.ALERTAS_EMAIL;
}

const claveUltima = (clave: string) => `alerta:${clave}:ultima`;

/**
 * El mail, sin mandarlo. Las alertas son internas: el titular va en texto y
 * no como imagen, para que se lea igual con las imágenes bloqueadas.
 */
export function armarAlerta(a: Alerta): { subject: string; html: string; text: string } {
  const cuando = new Date().toLocaleString("es-AR", {
    timeZone: ZONA,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const detalle = a.detalle
    ? `<div style="margin:0 0 28px;padding:14px 16px;border-radius:12px;background:${D.franjaGris};border:1px solid ${D.lineaSuave};font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12.5px;line-height:19px;color:${D.cordon};word-break:break-word;white-space:pre-wrap;">${esc(a.detalle)}</div>`
    : "";
  const html = marco({
    titulo: a.asunto,
    preheader: a.lineas[0] ?? a.asunto,
    rotulo: "Aviso del sistema",
    tarjeta:
      cuerpo(
        antetitulo(`Aviso del sistema · ${cuando}`) +
          `<h1 style="margin:0;padding-bottom:18px;font-family:${SANS};font-weight:600;font-size:24px;line-height:30px;letter-spacing:-0.02em;color:${D.tinta};">${esc(a.asunto)}</h1>` +
          a.lineas.map((l) => texto(esc(l))).join("") +
          detalle +
          (a.link ? boton(a.link.texto, a.link.url) : ""),
      ) +
      franjaGris(
        texto(
          `Por este mismo problema no vuelve a salir otro aviso hasta dentro de ${a.cadaMin ?? CADA_MIN} minutos, aunque se repita. El detalle de cada caso queda en los logs del servidor.`,
          0,
        ),
      ),
    pie: `Te llega porque tu dirección es la de ALERTAS_EMAIL en el servidor de <a href="${BASE}" style="color:${D.tenue};">encontrate.app</a>.`,
  });
  const text = [
    a.asunto,
    "",
    ...a.lineas,
    ...(a.detalle ? ["", a.detalle] : []),
    ...(a.link ? ["", `${a.link.texto}: ${a.link.url}`] : []),
  ].join("\n");
  return { subject: `[encontrate] ${a.asunto}`, html, text };
}

/**
 * Manda la alerta si la misma clave no sonó hace poco. Nunca lanza.
 *
 * La marca de «ya sonó» vive en Setting y se escribe ANTES de mandar, como el
 * reclamo de los correos: si el envío falla, se borra para que el próximo caso
 * lo vuelva a intentar. Entre leer la marca y escribirla no hay transacción;
 * con una sola instancia (ecosystem.config.cjs) alcanza, y el costo de que dos
 * pedidos se crucen es un mail de más, no uno de menos.
 */
export async function alertar(a: Alerta): Promise<ResultadoAlerta> {
  const etiqueta = `[alerta ${a.clave}]`;
  console.error(etiqueta, a.asunto, "·", a.lineas.join(" "), a.detalle ? `· ${a.detalle}` : "");
  const destino = env.ALERTAS_EMAIL;
  if (!destino) {
    console.warn(etiqueta, "sin ALERTAS_EMAIL: el aviso queda sólo en el log");
    return "sin-destino";
  }

  const key = claveUltima(a.clave);
  try {
    const ahora = new Date();
    const ultima = await db.setting.findUnique({ where: { key }, select: { value: true } });
    if (ultima && ahora.getTime() - new Date(ultima.value).getTime() < (a.cadaMin ?? CADA_MIN) * 60_000) {
      return "silenciada";
    }
    await db.setting.upsert({
      where: { key },
      update: { value: ahora.toISOString() },
      create: { key, value: ahora.toISOString() },
    });
  } catch (e) {
    console.error(etiqueta, "no se pudo leer la marca de silencio:", e);
    return "fallo";
  }

  try {
    const mail = armarAlerta(a);
    const r = await sendEmail({ to: destino, subject: mail.subject, html: mail.html, text: mail.text });
    if (!r) return "sin-destino"; // sin RESEND_API_KEY
    console.log(etiqueta, "enviada →", destino, "resend=" + r.id);
    return "enviada";
  } catch (e) {
    await db.setting.delete({ where: { key } }).catch(() => undefined);
    console.error(etiqueta, "no se pudo mandar el mail:", e);
    return "fallo";
  }
}

/** Un aviso de prueba a ALERTAS_EMAIL, sin marca de silencio. Para ver que llega. */
export async function enviarAlertaDePrueba(): Promise<{ destino: string | null; resendId: string | null }> {
  const destino = env.ALERTAS_EMAIL;
  if (!destino) return { destino: null, resendId: null };
  const mail = armarAlerta({
    clave: "prueba",
    asunto: "Los avisos del sistema llegan a esta dirección",
    lineas: [
      "Esto es una prueba pedida a mano desde /api/cron/pagos. No pasó nada.",
      "Cuando algo falle de verdad —una credencial de Mercado Pago que venció, una compra que no pudo iniciar el pago, un pago que el webhook no pudo leer— el aviso va a tener esta misma forma, con el detalle del error abajo.",
    ],
    detalle: `ALERTAS_EMAIL=${destino}\nenviada ${new Date().toISOString()}`,
    link: { texto: "Ver el estado de los pagos", url: `${BASE}/admin/sales` },
  });
  const r = await sendEmail({ to: destino, subject: mail.subject, html: mail.html, text: mail.text });
  return { destino, resendId: r?.id ?? null };
}
