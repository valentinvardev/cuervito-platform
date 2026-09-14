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

/* La paleta del panel (styles/v2/tokens.css, tema claro), en hexa porque un
   mail no puede leer variables ni rgba con transparencia sobre fondos que el
   cliente decide. --line es tinta al 10 % sobre blanco: #E7E6E2. */
const C = {
  base: "#FAFAF8",
  superficie: "#FFFFFF",
  suave: "#F1F0EC",
  linea: "#E7E6E2",
  texto: "#12110F",
  texto2: "#55524C",
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

/* Las de encontrate primero, la pila del sistema después.

   Un mail no puede dar por sentada una fuente web: Gmail las ignora, Apple
   Mail y la mayoría de los clientes de escritorio las cargan. Así que se pide
   Outfit y Unbounded —con <link> en el head y @import en el style, que es lo
   que cada cliente respeta— y se lista atrás lo que hay en cualquier máquina.
   Donde carga, el mail es encontrate; donde no, sigue siendo legible. */
const FUENTE =
  "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif";
const FUENTE_DISPLAY =
  "'Unbounded', 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif";

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  );
}

function pesos(centavos: number): string {
  return `$${(centavos / 100).toLocaleString("es-AR")}`;
}

export const BASE = env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, "");

/**
 * La marca: el logo entero —pájaro y nombre— como una sola imagen.
 *
 * Antes iba partido: el pájaro como imagen y el nombre tipeado, para que si el
 * cliente bloquea imágenes quedara al menos el nombre. Pero el nombre tipeado
 * en la fuente del sistema no es el logotipo, y la marca es una sola pieza.
 *
 * El archivo de marca (logo.png) tiene el dibujo en BLANCO, para fondo oscuro;
 * sobre el papel claro de estos mails desaparecería. logo-tinta.png es el mismo
 * dibujo relleno de tinta, generado del canal alfa del original —no hay dos
 * logos que mantener—. 812×178, así que a 28 de alto son 128 de ancho.
 *
 * Si el cliente no carga imágenes, se ve el alt: el nombre, en la fuente y el
 * color del texto. No es el logo, pero tampoco es un hueco.
 */
function marca(): string {
  return `<img src="${BASE}/marca/logo-tinta.png" width="128" height="28" alt="encontrate.app" style="display:block;border:0;outline:none;text-decoration:none;height:28px;width:auto;font-family:${FUENTE};font-weight:700;font-size:16px;color:${C.texto};" />`;
}
/**
 * El marco de todo mail de encontrate.
 *
 * `pie` es para los mails de campaña: ahí va el link de baja, que un mail que
 * uno no pidió tiene que tener sí o sí. Los transaccionales no lo mandan y
 * queda la firma de siempre.
 */
export function armar({
  preheader,
  cuerpo,
  pie,
}: {
  preheader: string;
  cuerpo: string;
  pie?: string;
}): string {
  return `<!doctype html>
<html lang="es" style="color-scheme:only light;supported-color-schemes:only light;"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="only light" />
<meta name="supported-color-schemes" content="only light" />
<meta name="x-apple-disable-message-reformatting" />
<title>encontrate.app</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=Unbounded:wght@700;800&display=swap" rel="stylesheet" />
<!--[if mso]>
<style type="text/css">body, table, td { font-family: Arial, Helvetica, sans-serif !important; }</style>
<![endif]-->
<style>
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=Unbounded:wght@700;800&display=swap');
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
      <tr><td bgcolor="${C.superficie}" class="en-caja" style="background:${C.superficie};border:1px solid ${C.linea};border-radius:16px;padding:36px 32px 14px;">
        ${cuerpo}
      </td></tr>
      <tr><td class="en-txt3" style="padding:20px 4px 0;color:${C.texto3};font-size:11.5px;line-height:1.5;text-align:left;font-family:${FUENTE};">
        <a href="${BASE}" class="en-txt3" style="color:${C.texto3};text-decoration:underline;">encontrate.app</a> — donde los atletas encuentran sus fotos.${pie ? `<br /><br />${pie}` : ""}
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

/**
 * El botón. Con aire debajo: antes tenía margin:0 y lo que viniera después
 * —una nota al pie, el borde de la tarjeta— quedaba pegado al botón. El margen
 * va en la tabla y no en el <a> porque Outlook ignora el margin de los inline.
 */
export function boton(texto: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 24px;"><tr><td bgcolor="${C.acentoLleno}" style="background:${C.acentoLleno};border-radius:10px;"><a href="${url}" style="display:inline-block;padding:15px 26px;color:${C.sobreAcento};font-family:${FUENTE};font-weight:600;font-size:15px;text-decoration:none;letter-spacing:-0.01em;">${esc(texto)}</a></td></tr></table>`;
}

export function botonSuave(texto: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 24px;"><tr><td bgcolor="${C.superficie}" class="en-caja" style="background:${C.superficie};border:1px solid ${C.linea};border-radius:10px;"><a href="${url}" class="en-txt" style="display:inline-block;padding:14px 24px;color:${C.texto};font-family:${FUENTE};font-weight:500;font-size:14px;text-decoration:none;">${esc(texto)}</a></td></tr></table>`;
}

export function titulo(t: string): string {
  return `<h1 class="en-txt" style="margin:0 0 14px;font-family:${FUENTE_DISPLAY};font-weight:700;font-size:24px;line-height:1.18;letter-spacing:-0.02em;color:${C.texto};">${esc(t)}</h1>`;
}

export function parrafo(html: string): string {
  return `<p class="en-txt2" style="margin:0 0 18px;font-family:${FUENTE};font-size:15px;line-height:1.6;color:${C.texto2};">${html}</p>`;
}

/** El número grande del mail: la plata, o la cantidad de fotos. */
export function cifra(rotulo: string, valor: string, nota?: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;"><tr><td bgcolor="${C.suave}" class="en-suave" style="background:${C.suave};border-radius:10px;padding:18px 20px;">
    <div class="en-txt3" style="font-family:${FUENTE};font-size:11.5px;letter-spacing:0.06em;text-transform:uppercase;color:${C.texto3};">${esc(rotulo)}</div>
    <div class="en-txt" style="font-family:${FUENTE_DISPLAY};font-size:28px;font-weight:700;letter-spacing:-0.02em;color:${C.texto};margin-top:5px;">${esc(valor)}</div>
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
          url: `${BASE}/dashboard/nuevo`,
          b: "Crear un evento",
        }
      : {
          t: "Ya está todo listo",
          d: "Tenés tu cuenta lista para vender.",
          url: `${BASE}/dashboard`,
          b: "Ir a mi panel",
        };

  return armar({
    preheader: `${paso.t} — ${paso.d}`,
    cuerpo: `
      ${titulo(`Bienvenido, ${i.name.split(" ")[0] ?? i.name}`)}
      ${parrafo("Tu cuenta está creada. Desde acá vas a subir tus fotos, y el atleta las encuentra con una selfie o con su número de dorsal.")}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;"><tr><td bgcolor="${C.suave}" class="en-suave" style="background:${C.suave};border-radius:10px;padding:18px 20px;">
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
   SaleItemSummary vive en email.ts, al lado de sendEmail, porque lo arma el
   notificador y lo consume esto: es el contrato entre los dos. */

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
      ${botonSuave("Ver la venta", `${BASE}/dashboard/ventas`)}
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
      ${botonSuave("Ver mis ventas", `${BASE}/dashboard/ventas`)}
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
      ${botonSuave("Ver el detalle", `${BASE}/dashboard/ventas`)}
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
  /** "Te queda el 20 % de lo que vendas", ya redactado por quien invita. */
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
 * mails de verdad.
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
