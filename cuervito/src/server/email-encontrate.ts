import "server-only";

import { env } from "~/env";

// El resumen de venta se comparte con email.ts en vez de redefinirlo: es el
// mismo dato, y dos formas del mismo resumen divergen sin que nadie se entere.
import type { SaleItemSummary } from "./email";

/* ============================================================================
 * Los mails de encontrate.app
 * ----------------------------------------------------------------------------
 * Mismas funciones que email.ts —mismos nombres, mismos parámetros— con la
 * identidad nueva: fondo claro, la foto y el número como lo único con peso, y
 * un solo botón por mail.
 *
 * Están aparte y no reemplazando a las de cuervito porque el cambio de marca en
 * los mails es una decisión de despliegue: el día que se corte, se cambia el
 * import en los cinco lugares que los mandan y listo. Tenerlos en el mismo
 * archivo con un if adentro dejaría dos versiones de cada plantilla
 * entreveradas, y las plantillas de mail son justo donde eso se pudre.
 *
 * Reglas de HTML para mail, que no son las de una página:
 *
 * · Tablas para la estructura. Outlook sigue usando el motor de Word y no
 *   entiende flex ni grid.
 * · Estilos en línea. Gmail borra el <style> del <head> en varias vistas.
 * · Sin tipografías web: muchos clientes las bloquean. Una pila de sistema.
 * · bgcolor además de background: Outlook ignora el CSS de fondo.
 * ========================================================================= */

const C = {
  base: "#FBFAF8",
  superficie: "#FFFFFF",
  suave: "#F2F0EC",
  linea: "#E6E2DC",
  texto: "#12110F",
  texto2: "#4A453F",
  /* 4,63:1 sobre blanco. El #8B857D que tenía daba 3,65 y no llega a AA, y
     éste es justamente el color de la letra chica: el vencimiento del link, el
     pie, los rótulos. */
  texto3: "#6E6A62",
  acento: "#F0410F",
  /* Blanco sobre el acento de marca da 3,84:1, que no llega a AA. Para el
     botón se usa este, más oscuro, que da 5,38:1 con blanco. Es el mismo
     criterio que en el panel. */
  acentoLleno: "#C7330B",
  ok: "#1E7A4D",
  sobreAcento: "#FFFFFF",
} as const;

const FUENTE =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif";

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  );
}

function pesos(centavos: number): string {
  return `$${(centavos / 100).toLocaleString("es-AR")}`;
}

const BASE = env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, "");

/**
 * La marca: el pájaro como imagen, el nombre como texto.
 *
 * Era todo texto, y por una buena razón: la mayoría de los clientes no cargan
 * imágenes hasta que uno aprieta "mostrar imágenes", y un mail que abre con un
 * rectángulo vacío arriba parece roto o parece spam.
 *
 * Así que el logotipo entra partido. El pájaro va como imagen —decorativa, con
 * alt vacío— y el nombre queda en texto: si el cliente bloquea las imágenes no
 * aparece un hueco, aparece el nombre solo, que es exactamente lo que había
 * antes. No se pierde nada y se gana la marca cuando las imágenes sí cargan.
 *
 * NO se usa el logotipo completo: ese archivo tiene el texto en BLANCO, para
 * fondo oscuro. Sobre el papel claro de estos mails desaparecería.
 *
 * Va la versión en TINTA del isotipo y no el archivo de la marca.
 *
 * El isotipo de encontrate es la silueta en blanco sobre transparente: como
 * máscara CSS toma el color del texto, pero un mail no puede usar máscaras y
 * el <img> blanco sobre el papel claro de estos mails es invisible. Se probó.
 * isotipo-tinta.png es el mismo dibujo relleno de tinta, generado del canal
 * alfa del original, así que no hay dos siluetas que mantener.
 */
function marca(): string {
  const pajaro = `${BASE}/marca/isotipo-tinta.png`;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>` +
    `<td style="padding-right:8px;line-height:0;vertical-align:middle;">` +
    `<img src="${pajaro}" width="17" height="22" alt="" style="display:block;border:0;outline:none;text-decoration:none;" />` +
    `</td>` +
    `<td style="vertical-align:middle;font-family:${FUENTE};font-size:17px;font-weight:800;letter-spacing:-0.03em;color:${C.texto};">` +
    `Encontrate<span style="color:${C.acento};">.app</span>` +
    `</td></tr></table>`;
}
function armar({ preheader, cuerpo }: { preheader: string; cuerpo: string }): string {
  return `<!doctype html>
<html lang="es" style="color-scheme:only light;supported-color-schemes:only light;"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="only light" />
<meta name="supported-color-schemes" content="only light" />
<meta name="x-apple-disable-message-reformatting" />
<title>encontrate.app</title>
<!--[if mso]>
<style type="text/css">body, table, td { font-family: Arial, Helvetica, sans-serif !important; }</style>
<![endif]-->
<style>
/* Gmail en modo oscuro le pone [data-ogsc]/[data-ogsb] a todo y auto-invierte
   los colores. Como este diseño ya es claro, se vuelven a fijar los nuestros
   para que no termine en un gris lavado que no es de nadie. */
[data-ogsc] body, [data-ogsb] body { background:${C.base} !important; }
[data-ogsc] .en-caja, [data-ogsb] .en-caja { background:${C.superficie} !important; }
[data-ogsc] .en-suave, [data-ogsb] .en-suave { background:${C.suave} !important; }
[data-ogsc] .en-txt, [data-ogsb] .en-txt { color:${C.texto} !important; }
[data-ogsc] .en-txt2, [data-ogsb] .en-txt2 { color:${C.texto2} !important; }
[data-ogsc] .en-txt3, [data-ogsb] .en-txt3 { color:${C.texto3} !important; }
</style>
</head>
<body bgcolor="${C.base}" style="margin:0;padding:0;background:${C.base};color:${C.texto};font-family:${FUENTE};">
<div style="display:none;max-height:0;overflow:hidden;color:transparent;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.base}" style="background:${C.base};padding:40px 16px;">
  <tr><td align="center" bgcolor="${C.base}" style="background:${C.base};">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">
      <tr><td style="padding:0 4px 22px;">${marca()}</td></tr>
      <tr><td bgcolor="${C.superficie}" class="en-caja" style="background:${C.superficie};border:1px solid ${C.linea};border-radius:16px;padding:36px 32px;">
        ${cuerpo}
      </td></tr>
      <tr><td class="en-txt3" style="padding:20px 4px 0;color:${C.texto3};font-size:11.5px;line-height:1.5;text-align:left;font-family:${FUENTE};">
        <a href="${BASE}" class="en-txt3" style="color:${C.texto3};text-decoration:underline;">encontrate.app</a> — donde los atletas encuentran sus fotos.
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

function boton(texto: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0;"><tr><td bgcolor="${C.acentoLleno}" style="background:${C.acentoLleno};border-radius:11px;"><a href="${url}" style="display:inline-block;padding:14px 26px;color:${C.sobreAcento};font-family:${FUENTE};font-weight:600;font-size:15px;text-decoration:none;letter-spacing:-0.01em;">${esc(texto)}</a></td></tr></table>`;
}

function botonSuave(texto: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0;"><tr><td bgcolor="${C.superficie}" class="en-caja" style="background:${C.superficie};border:1px solid ${C.linea};border-radius:11px;"><a href="${url}" class="en-txt" style="display:inline-block;padding:13px 24px;color:${C.texto};font-family:${FUENTE};font-weight:500;font-size:14px;text-decoration:none;">${esc(texto)}</a></td></tr></table>`;
}

function titulo(t: string): string {
  return `<h1 class="en-txt" style="margin:0 0 14px;font-family:${FUENTE};font-weight:800;font-size:28px;line-height:1.12;letter-spacing:-0.03em;color:${C.texto};">${esc(t)}</h1>`;
}

function parrafo(html: string): string {
  return `<p class="en-txt2" style="margin:0 0 18px;font-family:${FUENTE};font-size:15px;line-height:1.55;color:${C.texto2};">${html}</p>`;
}

/** El número grande del mail: la plata, o la cantidad de fotos. */
function cifra(rotulo: string, valor: string, nota?: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;"><tr><td bgcolor="${C.suave}" class="en-suave" style="background:${C.suave};border-radius:12px;padding:18px 20px;">
    <div class="en-txt3" style="font-family:${FUENTE};font-size:11.5px;letter-spacing:0.06em;text-transform:uppercase;color:${C.texto3};">${esc(rotulo)}</div>
    <div class="en-txt" style="font-family:${FUENTE};font-size:32px;font-weight:700;letter-spacing:-0.03em;color:${C.texto};margin-top:5px;">${esc(valor)}</div>
    ${nota ? `<div class="en-txt2" style="font-family:${FUENTE};font-size:12.5px;color:${C.texto2};margin-top:6px;">${esc(nota)}</div>` : ""}
  </td></tr></table>`;
}

/** Una lista de datos, clave a la izquierda y valor a la derecha. */
function datos(filas: [string, string][]): string {
  const tr = filas
    .map(
      ([k, v]) =>
        `<tr><td class="en-txt3" style="font-family:${FUENTE};font-size:13px;color:${C.texto3};padding:5px 0;">${esc(k)}</td><td align="right" class="en-txt" style="font-family:${FUENTE};font-size:13px;color:${C.texto};padding:5px 0;font-weight:500;">${esc(v)}</td></tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">${tr}</table>`;
}

/* ── 1) Bienvenida ───────────────────────────────────────────────────────── */

export type WelcomeEmailInput = {
  name: string;
  hasMpConnected: boolean;
  hasFirstEvent: boolean;
};

export function welcomeEmailHtml(i: WelcomeEmailInput): string {
  // Se muestra UN solo paso, el que falta primero. Una lista de tres pendientes
  // en el primer mail se lee como trabajo, no como bienvenida.
  const paso = !i.hasMpConnected
    ? {
        t: "Conectá Mercado Pago",
        d: "Es lo único que hace falta para poder cobrar. Toma dos minutos.",
        url: `${BASE}/onboarding/mp`,
        b: "Conectar Mercado Pago",
      }
    : !i.hasFirstEvent
      ? {
          t: "Creá tu primer evento",
          d: "Subís las fotos y te queda un link para repartir.",
          url: `${BASE}/v2/nuevo`,
          b: "Crear un evento",
        }
      : {
          t: "Ya está todo listo",
          d: "Tenés tu cuenta lista para vender.",
          url: `${BASE}/v2`,
          b: "Ir a mi panel",
        };

  return armar({
    preheader: `${paso.t} — ${paso.d}`,
    cuerpo: `
      ${titulo(`Bienvenido, ${i.name.split(" ")[0] ?? i.name}`)}
      ${parrafo("Tu cuenta está creada. Desde acá vas a subir tus fotos, y el atleta las encuentra con una selfie o con su número de dorsal.")}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;"><tr><td bgcolor="${C.suave}" class="en-suave" style="background:${C.suave};border-radius:12px;padding:18px 20px;">
        <div class="en-txt" style="font-family:${FUENTE};font-size:15px;font-weight:600;color:${C.texto};">${esc(paso.t)}</div>
        <div class="en-txt2" style="font-family:${FUENTE};font-size:13.5px;line-height:1.5;color:${C.texto2};margin-top:4px;">${esc(paso.d)}</div>
      </td></tr></table>
      ${boton(paso.b, paso.url)}
    `,
  });
}

/* ── 2) Entrega al comprador ─────────────────────────────────────────────── */

export type DeliveryEmailInput = {
  buyerName?: string;
  eventName: string;
  photoCount: number;
  downloadUrl: string;
  expiresAt?: Date;
};

export function deliveryEmailHtml(i: DeliveryEmailInput): string {
  const nombre = i.buyerName?.split(" ")[0];
  const vence = i.expiresAt
    ? i.expiresAt.toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" })
    : null;

  return armar({
    preheader: `${i.photoCount} ${i.photoCount === 1 ? "foto lista" : "fotos listas"} de ${i.eventName}`,
    cuerpo: `
      ${titulo(nombre ? `Listo, ${nombre}. Son tuyas.` : "Listo. Son tuyas.")}
      ${parrafo(`Tus fotos de <strong class="en-txt" style="color:${C.texto};font-weight:600;">${esc(i.eventName)}</strong>, sin marca de agua y en calidad original.`)}
      ${cifra(i.photoCount === 1 ? "Tu foto" : "Tus fotos", String(i.photoCount), "Las bajás todas juntas en un .zip")}
      ${boton("Bajar mis fotos", i.downloadUrl)}
      ${
        vence
          ? parrafo(
              `<span style="color:${C.texto3};font-size:13px;">El link funciona hasta el <strong style="color:${C.texto2};">${esc(vence)}</strong>. Guardalo: podés volver a bajarlas todas las veces que quieras hasta esa fecha.</span>`,
            )
          : ""
      }
    `,
  });
}

/* ── 3) Aviso de venta al fotógrafo ──────────────────────────────────────────
   Las tres firmas son EXACTAMENTE las de email.ts, incluido SaleItemSummary,
   que se importa en vez de redefinirse.

   Las había escrito por mi cuenta con otros parámetros —eventName suelto,
   netCents, buyerEmail— y no servían. El selector de plantillas promete que los
   dos módulos son intercambiables, y con firmas distintas esa promesa se rompe
   justo en el lugar donde importa: al mandar el mail. */

export function saleEmailSingleHtml(i: {
  photographerName: string;
  sale: SaleItemSummary;
}): string {
  const nombre = i.photographerName.split(" ")[0] ?? "Hola";
  const comprador = i.sale.buyerName ?? "Alguien";
  return armar({
    preheader: `Vendiste ${i.sale.itemCount} ${i.sale.itemCount === 1 ? "foto" : "fotos"} — te quedan ${pesos(i.sale.sellerNetCents)}`,
    cuerpo: `
      ${titulo(`${nombre}, vendiste`)}
      ${parrafo(`<strong class="en-txt" style="color:${C.texto};font-weight:600;">${esc(comprador)}</strong> compró ${i.sale.itemCount === 1 ? "una foto" : `${i.sale.itemCount} fotos`} de <strong class="en-txt" style="color:${C.texto};font-weight:600;">${esc(i.sale.eventName)}</strong>.`)}
      ${cifra("Te quedan", pesos(i.sale.sellerNetCents), "Ya está en tu Mercado Pago, con la comisión descontada")}
      ${botonSuave("Ver la venta", `${BASE}/v2/ventas`)}
    `,
  });
}

export function saleEmailSmallBatchHtml(i: {
  photographerName: string;
  sales: SaleItemSummary[];
}): string {
  const nombre = i.photographerName.split(" ")[0] ?? "Hola";
  const neto = i.sales.reduce((a, s) => a + s.sellerNetCents, 0);
  const fotos = i.sales.reduce((a, s) => a + s.itemCount, 0);
  return armar({
    preheader: `${i.sales.length} ventas — te quedan ${pesos(neto)}`,
    cuerpo: `
      ${titulo(`${nombre}, ${i.sales.length} ventas nuevas`)}
      ${cifra("Te quedan", pesos(neto), `${fotos} ${fotos === 1 ? "foto" : "fotos"} en total`)}
      ${datos(
        i.sales.map((s) => [
          s.buyerName ?? "Alguien",
          `${s.itemCount} · ${pesos(s.sellerNetCents)}`,
        ]),
      )}
      ${botonSuave("Ver mis ventas", `${BASE}/v2/ventas`)}
    `,
  });
}

export function saleEmailBigBatchHtml(i: {
  photographerName: string;
  sales: SaleItemSummary[];
}): string {
  const nombre = i.photographerName.split(" ")[0] ?? "Hola";
  const neto = i.sales.reduce((a, s) => a + s.sellerNetCents, 0);
  const fotos = i.sales.reduce((a, s) => a + s.itemCount, 0);
  const evento = i.sales[0]?.eventName ?? "tus eventos";
  return armar({
    preheader: `${i.sales.length} ventas — te quedan ${pesos(neto)}`,
    cuerpo: `
      ${titulo(`${nombre}, se está vendiendo`)}
      ${parrafo(`<strong class="en-txt" style="color:${C.texto};font-weight:600;">${esc(evento)}</strong> tuvo ${i.sales.length} ventas.`)}
      ${cifra("Te quedan", pesos(neto), `${fotos} fotos en ${i.sales.length} ventas`)}
      ${botonSuave("Ver el detalle", `${BASE}/v2/ventas`)}
    `,
  });
}

/* ── 4) Recuperar la contraseña ──────────────────────────────────────────── */

export type PasswordResetEmailInput = { name: string; resetUrl: string };

export function passwordResetEmailHtml(i: PasswordResetEmailInput): string {
  return armar({
    preheader: "Cambiá tu contraseña — el link vence en una hora",
    cuerpo: `
      ${titulo("Cambiá tu contraseña")}
      ${parrafo("Pediste recuperar el acceso a tu cuenta. El link de abajo vence en una hora.")}
      ${boton("Elegir una contraseña nueva", i.resetUrl)}
      ${parrafo(`<span style="color:${C.texto3};font-size:13px;">Si no pediste esto, ignorá el mail: tu contraseña sigue siendo la misma y nadie entró a tu cuenta.</span>`)}
    `,
  });
}

/* ── 5) Invitación a cubrir un evento ────────────────────────────────────── */

export type CollaboratorInviteInput = {
  inviterName: string;
  eventName: string;
  acceptUrl: string;
  /** Mismo nombre que en email.ts: los dos módulos se llaman desde el mismo
   *  lugar, así que las firmas tienen que ser intercambiables. */
  commissionLine?: string;
};

export function collaboratorInviteHtml(i: CollaboratorInviteInput): string {
  return armar({
    preheader: `${i.inviterName} te invita a cubrir ${i.eventName}`,
    cuerpo: `
      ${titulo("Te invitaron a cubrir un evento")}
      ${parrafo(`<strong class="en-txt" style="color:${C.texto};font-weight:600;">${esc(i.inviterName)}</strong> te invita a subir tus fotos a <strong class="en-txt" style="color:${C.texto};font-weight:600;">${esc(i.eventName)}</strong>.`)}
      ${datos([
        ["Podés", "Subir tus fotos y ver cuánto vendieron"],
        ["No podés", "Ver las ventas de los demás ni cambiar el precio"],
        ...(i.commissionLine
          ? ([["Te queda", i.commissionLine]] as [string, string][])
          : []),
      ])}
      ${parrafo(`<span style="color:${C.texto3};font-size:13px;">Las ventas entran en la cuenta de Mercado Pago de quien organiza el evento. Lo que te corresponde queda registrado y te lo pasa esa persona.</span>`)}
      ${boton("Aceptar la invitación", i.acceptUrl)}
    `,
  });
}

/**
 * Todas las plantillas juntas, para poder verlas en una pantalla sin mandar
 * mails de verdad. La usa /v2/ayuda cuando corre en desarrollo.
 */
export const PLANTILLAS_ENCONTRATE = {
  bienvenida: () =>
    welcomeEmailHtml({ name: "Germán Sosa", hasMpConnected: false, hasFirstEvent: false }),
  entrega: () =>
    deliveryEmailHtml({
      buyerName: "Lucía Fernández",
      eventName: "Duatlón Club Ciclista Chivilcoy",
      photoCount: 7,
      downloadUrl: `${BASE}/descarga/demo`,
      expiresAt: new Date(Date.now() + 72 * 3600 * 1000),
    }),
  venta: () =>
    saleEmailSingleHtml({
      photographerName: "Germán Sosa",
      sale: {
        eventName: "Duatlón Club Ciclista Chivilcoy",
        itemCount: 3,
        totalCents: 540000,
        sellerNetCents: 486000,
        buyerName: "Lucía Fernández",
        paidAt: new Date().toISOString(),
      },
    }),
  contrasena: () =>
    passwordResetEmailHtml({ name: "Germán", resetUrl: `${BASE}/reset/demo` }),
  invitacion: () =>
    collaboratorInviteHtml({
      inviterName: "Germán Sosa",
      eventName: "Duatlón Club Ciclista Chivilcoy",
      acceptUrl: `${BASE}/invitacion/demo`,
      commissionLine: "70% de las ventas de tus fotos",
    }),
} as const;
