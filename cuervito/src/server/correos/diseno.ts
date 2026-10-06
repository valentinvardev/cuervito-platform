import "server-only";

import { env } from "~/env";

/** La dirección de la app, sin la barra final. Vive acá y no en
    email-encontrate.ts para que las plantillas puedan usar estas piezas sin
    importarse en círculo; allá se reexporta para lo que ya la pedía. */
export const BASE = env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, "");

/* ============================================================================
 * El diseño nuevo de los mails, en HTML de mail.
 * ----------------------------------------------------------------------------
 * Sale del archivo "encontrate — mails" de Paper: fondo de vereda, una tarjeta
 * blanca, títulos en Unbounded y el dorsal —franja naranja, número grande,
 * los cuatro agujeros del alfiler— como la pieza que dice el número que
 * importa en cada mail.
 *
 * La tipografía es la de la landing (styles/v2/tokens.css y
 * landing-encontrate.css), no otra parecida: titulares en Unbounded 800 en
 * caja alta con el tracking cerrado, los números grandes en Outfit 200 —el
 * fino, como el precio de la landing—, los rótulos en Outfit 500 chico y
 * espaciado, y el texto en Outfit 400. El que llega desde la landing tiene
 * que reconocer la marca en el mail sin leer el logo.
 *
 * Las mismas reglas que email-encontrate.ts, porque un mail no es una página:
 * tablas para la estructura (Outlook usa el motor de Word), estilos en línea
 * (Gmail borra el <style> en varias vistas), bgcolor además de background, y
 * fuentes de la marca con respaldo de sistema. Arial Black va de respaldo de
 * Unbounded porque es lo más parecido en peso que tiene cualquier máquina.
 *
 * Lo que en Paper es posición absoluta —los agujeros del dorsal— acá son
 * celdas: lo absoluto no existe en un mail.
 * ========================================================================= */

export const D = {
  vereda: "#EFEEE9",
  tarjeta: "#FFFFFF",
  franjaGris: "#F7F6F2",
  lineaSuave: "#ECEAE4",
  linea: "#E2E0DA",
  bordeDorsal: "#DEDBD4",
  agujero: "#CFCBC3",
  tinta: "#12110F",
  cordon: "#57534C",
  tenue: "#6E6A62",
  cono: "#F0410F",
  /* Blanco sobre el naranja de marca da 3,84:1; éste, 5,38:1. */
  conoOscuro: "#C7330B",
  /* El verde de WhatsApp del panel, no el de la marca: con blanco encima el
     de la marca no se lee. */
  whatsapp: "#0A7C42",
  /* El verde de "ok" del panel: lo que sí se puede, lo que salió bien. */
  ok: "#1E7A4D",
} as const;

export const SANS =
  "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif";
export const DISPLAY =
  "'Unbounded', 'Arial Black', 'Helvetica Neue', Arial, sans-serif";

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  );
}

/**
 * El marco: cabecera con el logo y el rótulo, la tarjeta, y el pie.
 *
 * `tarjeta` va adentro de la tarjeta, de borde a borde: cada mail decide sus
 * bloques (cuerpo con aire, franja gris al pie). `pie` es lo de abajo de la
 * firma: el porqué del mail y, en los que se pueden apagar, la baja.
 */
export function marco({
  titulo,
  preheader,
  rotulo,
  tarjeta,
  pie,
}: {
  titulo: string;
  preheader: string;
  rotulo: string;
  tarjeta: string;
  pie: string;
}): string {
  return `<!doctype html>
<html lang="es" style="color-scheme:only light;supported-color-schemes:only light;"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="only light" />
<meta name="supported-color-schemes" content="only light" />
<meta name="x-apple-disable-message-reformatting" />
<title>${esc(titulo)}</title>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@200;400;500;600&family=Unbounded:wght@800&display=swap" rel="stylesheet" />
<!--[if mso]>
<style type="text/css">body, table, td, div, a { font-family: Arial, Helvetica, sans-serif !important; }</style>
<![endif]-->
<style>
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@200;400;500;600&family=Unbounded:wght@800&display=swap');
[data-ogsc] body, [data-ogsb] body { background:${D.vereda} !important; }
[data-ogsc] .en-caja, [data-ogsb] .en-caja { background:${D.tarjeta} !important; }
[data-ogsc] .en-gris, [data-ogsb] .en-gris { background:${D.franjaGris} !important; }
@media (max-width: 520px) {
  .en-pad { padding-left: 22px !important; padding-right: 22px !important; }
  .en-titulo { font-size: 24px !important; line-height: 26px !important; }
  .en-cifra { font-size: 72px !important; line-height: 70px !important; }
  /* El texto que acompaña a la historia, cuando queda abajo de ella. */
  .en-hist { padding-left: 0 !important; }
}
</style>
</head>
<body bgcolor="${D.vereda}" style="margin:0;padding:0;background:${D.vereda};">
<div style="display:none;max-height:0;overflow:hidden;color:transparent;opacity:0;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${D.vereda}" style="background:${D.vereda};">
  <tr><td align="center" style="padding:32px 12px 40px;">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;">
      <tr><td style="padding:0 12px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td valign="middle"><img src="${BASE}/marca/logo-tinta.png" width="119" height="26" alt="encontrate.app" style="display:block;border:0;height:26px;width:119px;font-family:${SANS};font-weight:700;font-size:16px;color:${D.tinta};" /></td>
          <td valign="middle" align="right" style="font-family:${SANS};font-weight:500;font-size:10.5px;letter-spacing:0.2em;text-transform:uppercase;color:${D.cordon};">${esc(rotulo)}</td>
        </tr></table>
      </td></tr>
      <tr><td class="en-caja" bgcolor="${D.tarjeta}" style="background:${D.tarjeta};border-radius:20px;overflow:hidden;">
        ${tarjeta}
      </td></tr>
      <tr><td style="padding:22px 12px 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td valign="top" style="padding:2px 12px 0 0;"><img src="${BASE}/marca/isotipo-tinta.png" width="17" height="22" alt="" style="display:block;border:0;opacity:0.55;" /></td>
          <td valign="top" style="font-family:${SANS};font-size:12.5px;line-height:19px;color:${D.tenue};">encontrate.app — donde los atletas encuentran sus fotos.<br />${pie}</td>
        </tr></table>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

/** El cuerpo de la tarjeta, con el aire de los costados. */
export function cuerpo(html: string, abajo = 40): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="en-pad" style="padding:36px 36px ${abajo}px;">${html}</td></tr></table>`;
}

/** La franja gris del pie de la tarjeta. */
export function franjaGris(html: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="en-gris en-pad" bgcolor="${D.franjaGris}" style="background:${D.franjaGris};border-top:1px solid ${D.lineaSuave};padding:24px 36px 28px;">${html}</td></tr></table>`;
}

/** El rótulo de arriba del titular: el meta de la landing, en el naranja que se lee. */
export function antetitulo(t: string): string {
  return `<div style="font-family:${SANS};font-weight:500;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${D.conoOscuro};padding-bottom:16px;">${esc(t)}</div>`;
}

/** El titular de la landing: Unbounded 800 en caja alta, tracking cerrado,
    interlineado corto porque las mayúsculas no tienen colas que choquen. */
export function titular(t: string): string {
  return `<h1 class="en-titulo" style="margin:0;padding-bottom:18px;font-family:${DISPLAY};font-weight:800;font-size:30px;line-height:32px;letter-spacing:-0.045em;text-transform:uppercase;color:${D.tinta};">${esc(t)}</h1>`;
}

export function texto(html: string, abajo = 28): string {
  return `<p style="margin:0;padding-bottom:${abajo}px;font-family:${SANS};font-size:16px;line-height:26px;color:${D.cordon};">${html}</p>`;
}

/** Texto fuerte dentro de un párrafo. */
export function fuerte(t: string): string {
  return `<strong style="color:${D.tinta};font-weight:600;">${esc(t)}</strong>`;
}

/** El botón lleno, con la flecha. Uno por mail. */
export function boton(t: string, url: string, color: string = D.conoOscuro): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="${color}" style="background:${color};border-radius:12px;"><a href="${url}" style="display:inline-block;padding:16px 26px;font-family:${SANS};font-weight:600;font-size:16px;letter-spacing:-0.01em;color:#FFFFFF;text-decoration:none;">${esc(t)}&nbsp;&nbsp;&rarr;</a></td></tr></table>`;
}

/** El botón de contorno, para lo secundario. */
export function botonContorno(t: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="${D.tarjeta}" style="background:${D.tarjeta};border:1.5px solid #D9D6CF;border-radius:12px;"><a href="${url}" style="display:inline-block;padding:14px 22px;font-family:${SANS};font-weight:600;font-size:15px;color:${D.tinta};text-decoration:none;">${esc(t)}&nbsp;&nbsp;&rarr;</a></td></tr></table>`;
}

/** Una pill: un link chico, redondo, de contorno. */
export function pill(t: string, url: string): string {
  return `<a href="${url}" style="display:inline-block;margin:0 6px 8px 0;padding:8px 14px;border:1px solid #D9D6CF;border-radius:999px;background:${D.tarjeta};font-family:${SANS};font-weight:500;font-size:13.5px;color:${D.tinta};text-decoration:none;">${esc(t)}</a>`;
}

/**
 * El dorsal: franja naranja con dos rótulos, el número grande y lo que es.
 *
 * Los agujeros del alfiler van en una fila arriba y otra abajo, en las celdas
 * de las puntas. En Paper están en posición absoluta; acá no hay tal cosa.
 */
export function dorsal({
  izq,
  der,
  cifra,
  que,
  detalle,
}: {
  izq: string;
  der: string;
  cifra: string;
  que: string;
  detalle?: string;
}): string {
  const agujero = `<div style="width:10px;height:10px;border-radius:50%;background:${D.vereda};border:1.5px solid ${D.agujero};font-size:0;line-height:0;">&nbsp;</div>`;
  const filaAgujeros = (arriba: boolean) =>
    `<tr><td style="padding:${arriba ? "14px 14px 0" : "0 14px 14px"};"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="left">${agujero}</td><td align="right">${agujero}</td></tr></table></td></tr>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1.5px solid ${D.bordeDorsal};border-radius:12px;border-collapse:separate;overflow:hidden;">
  <tr><td bgcolor="${D.cono}" style="background:${D.cono};border-radius:10px 10px 0 0;padding:12px 20px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="font-family:${SANS};font-weight:600;font-size:10.5px;letter-spacing:0.2em;text-transform:uppercase;color:${D.tinta};">${esc(izq)}</td>
      <td align="right" valign="top" style="padding-left:12px;white-space:nowrap;font-family:${SANS};font-weight:600;font-size:10.5px;letter-spacing:0.2em;text-transform:uppercase;color:${D.tinta};">${esc(der)}</td>
    </tr></table>
  </td></tr>
  ${filaAgujeros(true)}
  <tr><td align="center" class="en-cifra" style="padding:2px 20px 8px;font-family:${SANS};font-weight:200;font-size:96px;line-height:92px;letter-spacing:-0.07em;font-variant-numeric:tabular-nums;color:${D.tinta};">${esc(cifra)}</td></tr>
  <tr><td align="center" style="padding:0 20px;font-family:${SANS};font-weight:600;font-size:16px;line-height:22px;color:${D.tinta};">${esc(que)}</td></tr>
  ${detalle ? `<tr><td align="center" style="padding:6px 28px 0;font-family:${SANS};font-size:14px;line-height:20px;color:${D.cordon};">${esc(detalle)}</td></tr>` : ""}
  ${filaAgujeros(false)}
</table>`;
}
