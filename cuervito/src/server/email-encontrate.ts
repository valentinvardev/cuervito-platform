import "server-only";

import { BASE } from "./correos/diseno";

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

export { BASE };

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

/* ── Los mails de la cuenta ───────────────────────────────────────────────
   Bienvenida, entrega, avisos de venta, contraseña e invitación tienen el
   diseño nuevo y viven en correos/transaccionales.ts. Se reexportan acá con
   el mismo nombre para que mailsDe() y los que importan de este archivo no
   cambien. Las piezas de arriba (armar, boton, titulo…) las siguen usando
   las campañas de correos/plantillas.ts. */
export {
  collaboratorInviteHtml,
  deliveryEmailHtml,
  passwordResetEmailHtml,
  saleEmailBigBatchHtml,
  saleEmailSingleHtml,
  saleEmailSmallBatchHtml,
  welcomeEmailHtml,
  type CollaboratorInviteInput,
  type DeliveryEmailInput,
  type PasswordResetEmailInput,
  type WelcomeEmailInput,
} from "./correos/transaccionales";
