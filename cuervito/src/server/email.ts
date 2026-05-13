import "server-only";

import { Resend } from "resend";

import { env } from "~/env";

let _resend: Resend | null = null;
function client(): Resend | null {
  if (!env.RESEND_API_KEY) return null;
  _resend ??= new Resend(env.RESEND_API_KEY);
  return _resend;
}

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
};

export async function sendEmail(input: SendEmailInput): Promise<{ id: string } | null> {
  const r = client();
  if (!r) {
    console.warn("[email] RESEND_API_KEY not set — skipping", input.subject, "→", input.to);
    return null;
  }
  const res = await r.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    replyTo: input.replyTo,
  });
  if (res.error) {
    console.error("[email] send failed:", res.error);
    throw new Error(res.error.message ?? "Email send failed");
  }
  return { id: res.data?.id ?? "" };
}

/* ============================================================================
 * Visual identity — used by every template
 *
 * Colors lifted from styles.css. Inline-only (email clients strip <style>).
 * Webfonts via Google Fonts CSS with system fallbacks.
 * ========================================================================= */

const COLORS = {
  bgBase: "#0f0d0b",
  bgSurface: "#1a1614",
  bgElevated: "#241e1a",
  border: "#2e2823",
  borderAccent: "rgba(245,130,10,0.4)",
  textPrimary: "#f0ebe3",
  textSecondary: "#a89e8f",
  textTertiary: "#6e6557",
  accent: "#f5820a",
  accentDeep: "rgba(245,130,10,0.12)",
  success: "#4caf7d",
  warning: "#f5c842",
  onAccent: "#1a0d00",
} as const;

// Sans-serif everywhere. Email clients often block webfonts, so we list a
// short SF/Helvetica/Arial stack that's guaranteed to render. Headings just
// crank the weight on the same family — keeps the brand consistent.
const FONT_BODY =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif";
const FONT_DISPLAY = FONT_BODY;
const FONT_MONO =
  "ui-monospace, 'SF Mono', Menlo, Consolas, monospace";

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  );
}

function formatARS(cents: number): string {
  return `$${(cents / 100).toLocaleString("es-AR")}`;
}

/**
 * Cuervito wordmark — drawn with HTML so it survives email clients that strip
 * images. The orange dot is a tiny inline-block circle.
 *
 * Wrapped in a dark-bg pill so the orange stays legible on Gmail dark-mode
 * clients that aggressively invert colors. Pill background = bgSurface so it
 * blends with the card below it.
 */
function wordmark(): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="${COLORS.bgSurface}" style="background:${COLORS.bgSurface};padding:10px 14px;border-radius:10px;border:1px solid ${COLORS.border};"><span style="font-family:${FONT_DISPLAY};font-weight:800;font-size:24px;color:${COLORS.accent};letter-spacing:-0.025em;line-height:1;mso-line-height-rule:exactly;">cuerv<span style="display:inline-block;width:7px;height:7px;background:${COLORS.accent};border-radius:50%;margin:0 1px;vertical-align:baseline;mso-hide:all;"></span>to</span></td></tr></table>`;
}

type LayoutInput = {
  preheader: string;
  body: string;
  ctaText?: string;
  ctaUrl?: string;
};

function layout({ preheader, body }: LayoutInput): string {
  return `<!doctype html>
<html lang="es" style="color-scheme:only light;supported-color-schemes:only light;"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="only light" />
<meta name="supported-color-schemes" content="only light" />
<meta name="x-apple-disable-message-reformatting" />
<title>Cuervito</title>
<!--[if mso]>
<style type="text/css">body, table, td { font-family: Arial, Helvetica, sans-serif !important; }</style>
<![endif]-->
<style>
/* Gmail dark-mode hooks: when Gmail flips to dark mode, [data-ogsc]/[data-ogsb]
   are applied to every node. We re-assert our colors so the theme doesn't
   wash out into Gmail's auto-inverted palette. */
[data-ogsc] body, [data-ogsb] body { background:${COLORS.bgBase} !important; }
[data-ogsc] .cv-card, [data-ogsb] .cv-card { background:${COLORS.bgSurface} !important; }
[data-ogsc] .cv-elevated, [data-ogsb] .cv-elevated { background:${COLORS.bgElevated} !important; }
[data-ogsc] .cv-text, [data-ogsb] .cv-text { color:${COLORS.textPrimary} !important; }
[data-ogsc] .cv-text-2, [data-ogsb] .cv-text-2 { color:${COLORS.textSecondary} !important; }
[data-ogsc] .cv-text-3, [data-ogsb] .cv-text-3 { color:${COLORS.textTertiary} !important; }
[data-ogsc] .cv-accent, [data-ogsb] .cv-accent { color:${COLORS.accent} !important; }
</style>
</head>
<body bgcolor="${COLORS.bgBase}" style="margin:0;padding:0;background:${COLORS.bgBase};color:${COLORS.textPrimary};font-family:${FONT_BODY};">
<div style="display:none;max-height:0;overflow:hidden;color:transparent;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COLORS.bgBase}" style="background:${COLORS.bgBase};padding:40px 16px;">
  <tr><td align="center" bgcolor="${COLORS.bgBase}" style="background:${COLORS.bgBase};">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">
      <tr><td style="padding:0 4px 22px;">${wordmark()}</td></tr>
      <tr><td bgcolor="${COLORS.bgSurface}" class="cv-card" style="background:${COLORS.bgSurface};border:1px solid ${COLORS.border};border-radius:16px;padding:36px 32px;">
        ${body}
      </td></tr>
      <tr><td class="cv-text-3" style="padding:20px 4px 0;color:${COLORS.textTertiary};font-size:11.5px;line-height:1.5;text-align:left;font-family:${FONT_BODY};">
        Recibís este correo porque sos parte de <strong class="cv-text-2" style="color:${COLORS.textSecondary};">cuervito</strong>, la plataforma de fotos deportivas.<br>
        <a href="${env.NEXT_PUBLIC_BASE_URL}" class="cv-text-3" style="color:${COLORS.textTertiary};text-decoration:underline;">cuervito.app</a>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

function ctaButton(text: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0;"><tr><td bgcolor="${COLORS.accent}" style="background:${COLORS.accent};border-radius:10px;"><a href="${url}" style="display:inline-block;padding:14px 26px;color:${COLORS.onAccent};font-family:${FONT_BODY};font-weight:600;font-size:15px;text-decoration:none;letter-spacing:-0.005em;">${escapeHtml(text)}</a></td></tr></table>`;
}

function ctaButtonOutline(text: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0;"><tr><td bgcolor="${COLORS.bgSurface}" class="cv-card" style="background:${COLORS.bgSurface};border:1px solid ${COLORS.border};border-radius:10px;"><a href="${url}" class="cv-text" style="display:inline-block;padding:13px 24px;color:${COLORS.textPrimary};font-family:${FONT_BODY};font-weight:500;font-size:14px;text-decoration:none;">${escapeHtml(text)}</a></td></tr></table>`;
}

function heading(text: string): string {
  return `<h1 class="cv-text" style="margin:0 0 14px;font-family:${FONT_DISPLAY};font-weight:800;font-size:28px;line-height:1.15;letter-spacing:-0.02em;color:${COLORS.textPrimary};">${escapeHtml(text)}</h1>`;
}

function paragraph(text: string): string {
  return `<p class="cv-text-2" style="margin:0 0 18px;font-family:${FONT_BODY};font-size:15px;line-height:1.55;color:${COLORS.textSecondary};">${text}</p>`;
}

function eyebrow(text: string): string {
  return `<div class="cv-accent" style="font-family:${FONT_MONO};font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:${COLORS.accent};margin-bottom:14px;">${escapeHtml(text)}</div>`;
}

/* ============================================================================
 * 1) Welcome — sent after signup
 * ========================================================================= */

export type WelcomeEmailInput = {
  name: string;
  hasMpConnected: boolean;
  hasFirstEvent: boolean;
};

export function welcomeEmailHtml(input: WelcomeEmailInput): string {
  const baseUrl = env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, "");

  function step(num: number, ttl: string, sub: string, cta: string, ctaUrl: string, done: boolean) {
    const numberStyle = done
      ? `background:${COLORS.success};color:${COLORS.bgBase};`
      : `background:${COLORS.accentDeep};color:${COLORS.accent};border:1px solid ${COLORS.borderAccent};`;
    const numContent = done
      ? `<span style="font-family:${FONT_BODY};font-weight:700;font-size:16px;">✓</span>`
      : `<span style="font-family:${FONT_MONO};font-weight:500;font-size:14px;">${num}</span>`;

    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:14px;">
      <tr>
        <td width="36" valign="top" style="padding-right:14px;">
          <div style="width:30px;height:30px;border-radius:50%;${numberStyle}text-align:center;line-height:30px;">${numContent}</div>
        </td>
        <td valign="top">
          <div style="font-family:${FONT_DISPLAY};font-weight:700;font-size:16px;color:${COLORS.textPrimary};margin-bottom:3px;letter-spacing:-0.01em;">${escapeHtml(ttl)}</div>
          <div style="font-family:${FONT_BODY};font-size:13.5px;color:${COLORS.textSecondary};line-height:1.5;margin-bottom:${done ? "0" : "10px"};">${escapeHtml(sub)}</div>
          ${done ? "" : ctaButtonOutline(cta, ctaUrl)}
        </td>
      </tr>
    </table>`;
  }

  const body = `
    ${eyebrow("Bienvenida a cuervito")}
    ${heading(`Hola ${input.name}, qué bueno tenerte acá.`)}
    ${paragraph(
      `Cuervito es la plataforma más simple para vender las fotos que sacaste en eventos deportivos. Sin contratos largos, sin tomarte semanas configurar nada — armás tu galería, los corredores compran online y la plata cae directo en tu Mercado Pago.`,
    )}
    ${paragraph(`Tu próximo paso depende de qué tan listo estés:`)}

    <div style="margin:24px 0 8px;">
      ${step(
        1,
        "Conectá Mercado Pago",
        "Tarda 30 segundos. Sin esto no podés cobrar las ventas.",
        "Conectar mi cuenta MP",
        `${baseUrl}/dashboard/cobros`,
        input.hasMpConnected,
      )}
      ${step(
        2,
        "Creá tu primer evento",
        "Ponele nombre, fecha, lugar y precio por foto. Después subís las fotos y se publican.",
        "Crear evento",
        `${baseUrl}/dashboard/events/new`,
        input.hasFirstEvent,
      )}
      ${step(
        3,
        "Compartí el link de tu galería",
        "Apenas publiques el evento, te damos un link cuervito.app/tu-usuario que podés mandar por WhatsApp o pegar en tu Instagram. Las ventas te llegan automáticas.",
        "Ir a mi panel",
        `${baseUrl}/dashboard`,
        false,
      )}
    </div>

    <div bgcolor="${COLORS.bgElevated}" class="cv-elevated" style="margin-top:28px;padding:16px 18px;background:${COLORS.bgElevated};border:1px solid ${COLORS.borderAccent};border-radius:10px;font-size:13px;color:${COLORS.textSecondary};line-height:1.55;">
      <strong style="color:${COLORS.textPrimary};">¿Trabás en algo?</strong> Respondé este mail y te ayudamos. Somos un equipo chico, contestamos en horas hábiles.
    </div>
  `;

  return layout({
    preheader: "Tu cuenta de cuervito está lista. 3 pasos para tu primera venta.",
    body,
  });
}

/* ============================================================================
 * 2) Download (delivery) — sent to buyer after payment
 * ========================================================================= */

export type DeliveryEmailInput = {
  buyerName: string;
  eventName: string;
  photoCount: number;
  downloadUrl: string;
};

export function deliveryEmailHtml(input: DeliveryEmailInput): string {
  const firstName = input.buyerName.split(" ")[0] || "Hola";
  const body = `
    ${eyebrow("Tu compra está lista")}
    ${heading(`${firstName}, tus fotos ya están acá.`)}
    ${paragraph(
      `Acabás de comprar <strong style="color:${COLORS.textPrimary};">${input.photoCount} ${input.photoCount === 1 ? "foto" : "fotos"}</strong> del evento <strong style="color:${COLORS.textPrimary};">${escapeHtml(input.eventName)}</strong>. Te las dejamos en alta resolución, sin marca de agua.`,
    )}

    <div style="margin:22px 0 24px;">
      ${ctaButton("Ver y descargar mis fotos", input.downloadUrl)}
    </div>

    <div bgcolor="${COLORS.bgElevated}" class="cv-elevated" style="padding:14px 16px;background:${COLORS.bgElevated};border:1px solid ${COLORS.border};border-radius:10px;font-size:13px;color:${COLORS.textSecondary};line-height:1.55;">
      <div style="font-family:${FONT_MONO};font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:${COLORS.textTertiary};margin-bottom:6px;">Antes que se te pase</div>
      El link es <strong style="color:${COLORS.textPrimary};">tuyo y vence en 72 horas</strong>. Guardá las fotos en tu celu o compu apenas puedas. Si estás en iPhone, en la página de descarga hay un paso a paso para guardarlas en tu galería.
    </div>

    <p style="margin:22px 0 0;font-size:12.5px;color:${COLORS.textTertiary};line-height:1.5;word-break:break-all;">
      Si el botón no funciona, pegá este link en tu navegador:<br>
      <span style="color:${COLORS.textSecondary};">${input.downloadUrl}</span>
    </p>
  `;

  return layout({
    preheader: `${input.photoCount} ${input.photoCount === 1 ? "foto lista" : "fotos listas"} para descargar — válido por 72 horas.`,
    body,
  });
}

/* ============================================================================
 * 3) Sale notification — to seller
 * Three variants depending on how many sales are bundled.
 * ========================================================================= */

export type SaleItemSummary = {
  eventName: string;
  itemCount: number;
  totalCents: number;
  sellerNetCents: number;
  buyerName: string | null;
  paidAt: string; // ISO
};

/** 1 sale (used for sales 1–3 of the day) */
export function saleEmailSingleHtml(input: {
  photographerName: string;
  sale: SaleItemSummary;
}): string {
  const firstName = input.photographerName.split(" ")[0] || "Hola";
  const buyer = input.sale.buyerName ?? "Un comprador";
  const body = `
    ${eyebrow("Venta nueva")}
    ${heading(`${firstName}, ¡vendiste!`)}
    ${paragraph(
      `<strong style="color:${COLORS.textPrimary};">${escapeHtml(buyer)}</strong> compró <strong style="color:${COLORS.textPrimary};">${input.sale.itemCount} ${input.sale.itemCount === 1 ? "foto" : "fotos"}</strong> de <strong style="color:${COLORS.textPrimary};">${escapeHtml(input.sale.eventName)}</strong>.`,
    )}

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COLORS.bgElevated}" class="cv-elevated" style="background:${COLORS.bgElevated};border:1px solid ${COLORS.border};border-radius:12px;margin:18px 0 22px;">
      <tr>
        <td style="padding:18px 22px;">
          <div style="font-family:${FONT_MONO};font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:${COLORS.textTertiary};margin-bottom:6px;">Tu neto</div>
          <div style="font-family:${FONT_DISPLAY};font-weight:800;font-size:34px;color:${COLORS.accent};letter-spacing:-0.025em;line-height:1;">${formatARS(input.sale.sellerNetCents)}</div>
          <div style="font-size:12.5px;color:${COLORS.textSecondary};margin-top:6px;">de un total de <span style="font-family:${FONT_MONO};">${formatARS(input.sale.totalCents)}</span> · acreditado en tu Mercado Pago</div>
        </td>
      </tr>
    </table>

    <div style="margin:0 0 8px;">
      ${ctaButtonOutline("Ver detalle en mi panel", `${env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, "")}/dashboard/ventas`)}
    </div>
  `;

  return layout({
    preheader: `${formatARS(input.sale.sellerNetCents)} neto — ${input.sale.itemCount} ${input.sale.itemCount === 1 ? "foto" : "fotos"} de ${input.sale.eventName}`,
    body,
  });
}

/** 2–10 sales grouped (used for the 2x batching tier) */
export function saleEmailSmallBatchHtml(input: {
  photographerName: string;
  sales: SaleItemSummary[];
}): string {
  const firstName = input.photographerName.split(" ")[0] || "Hola";
  const count = input.sales.length;
  const totalNet = input.sales.reduce((s, x) => s + x.sellerNetCents, 0);
  const totalGross = input.sales.reduce((s, x) => s + x.totalCents, 0);

  const rows = input.sales
    .map((s) => {
      const time = new Date(s.paidAt).toLocaleTimeString("es-AR", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const buyer = s.buyerName ?? "Comprador";
      return `<tr>
        <td style="padding:12px 0;border-bottom:1px solid ${COLORS.border};">
          <div style="font-family:${FONT_BODY};font-weight:500;font-size:14px;color:${COLORS.textPrimary};margin-bottom:3px;">${escapeHtml(buyer)} · ${s.itemCount} ${s.itemCount === 1 ? "foto" : "fotos"}</div>
          <div style="font-size:12px;color:${COLORS.textTertiary};">${escapeHtml(s.eventName)} · ${time} hs</div>
        </td>
        <td style="padding:12px 0;border-bottom:1px solid ${COLORS.border};text-align:right;vertical-align:top;font-family:${FONT_MONO};font-size:14px;color:${COLORS.accent};font-weight:500;white-space:nowrap;">${formatARS(s.sellerNetCents)}</td>
      </tr>`;
    })
    .join("");

  const body = `
    ${eyebrow(`${count} ventas nuevas`)}
    ${heading(`${firstName}, ${count} ventas más cerraron.`)}
    ${paragraph(`Mientras estabas en otra, compraron tus fotos. Acá el detalle:`)}

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;">
      ${rows}
      <tr>
        <td style="padding:14px 0 0;font-family:${FONT_BODY};font-weight:500;font-size:14px;color:${COLORS.textSecondary};">Total neto</td>
        <td style="padding:14px 0 0;text-align:right;font-family:${FONT_DISPLAY};font-weight:800;font-size:24px;color:${COLORS.accent};letter-spacing:-0.02em;">${formatARS(totalNet)}</td>
      </tr>
      <tr>
        <td style="padding:2px 0 0;font-family:${FONT_BODY};font-size:11.5px;color:${COLORS.textTertiary};">de ${formatARS(totalGross)} totales</td>
        <td></td>
      </tr>
    </table>

    <div style="margin:14px 0 0;">
      ${ctaButton("Ver todas mis ventas", `${env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, "")}/dashboard/ventas`)}
    </div>
  `;

  return layout({
    preheader: `${count} ventas nuevas · ${formatARS(totalNet)} netos`,
    body,
  });
}

/** 5+ sales — same layout but with a "you're on fire" tone */
export function saleEmailBigBatchHtml(input: {
  photographerName: string;
  sales: SaleItemSummary[];
}): string {
  const firstName = input.photographerName.split(" ")[0] || "Hola";
  const count = input.sales.length;
  const totalNet = input.sales.reduce((s, x) => s + x.sellerNetCents, 0);
  const totalGross = input.sales.reduce((s, x) => s + x.totalCents, 0);
  const events = Array.from(new Set(input.sales.map((s) => s.eventName)));

  const rows = input.sales
    .map((s) => {
      const time = new Date(s.paidAt).toLocaleTimeString("es-AR", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const buyer = s.buyerName ?? "Comprador";
      return `<tr>
        <td style="padding:10px 0;border-bottom:1px solid ${COLORS.border};">
          <div style="font-family:${FONT_BODY};font-weight:500;font-size:13.5px;color:${COLORS.textPrimary};margin-bottom:2px;">${escapeHtml(buyer)} · ${s.itemCount} ${s.itemCount === 1 ? "foto" : "fotos"}</div>
          <div style="font-size:11.5px;color:${COLORS.textTertiary};">${escapeHtml(s.eventName)} · ${time} hs</div>
        </td>
        <td style="padding:10px 0;border-bottom:1px solid ${COLORS.border};text-align:right;vertical-align:top;font-family:${FONT_MONO};font-size:13px;color:${COLORS.accent};font-weight:500;white-space:nowrap;">${formatARS(s.sellerNetCents)}</td>
      </tr>`;
    })
    .join("");

  const body = `
    ${eyebrow(`🔥 ${count} ventas seguidas`)}
    ${heading(`${firstName}, esto se está moviendo fuerte.`)}
    ${paragraph(
      `Cerraste <strong style="color:${COLORS.textPrimary};">${count} ventas más</strong> ${events.length === 1 ? `en <strong style="color:${COLORS.textPrimary};">${escapeHtml(events[0]!)}</strong>` : `entre <strong style="color:${COLORS.textPrimary};">${events.length} eventos</strong>`}. Estás teniendo un buen día.`,
    )}

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0;">
      <tr>
        <td bgcolor="${COLORS.bgElevated}" class="cv-elevated" style="padding:18px 22px;background:${COLORS.bgElevated};border:1px solid ${COLORS.border};border-radius:12px;">
          <div style="font-family:${FONT_MONO};font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:${COLORS.textTertiary};margin-bottom:6px;">Neto este lote</div>
          <div style="font-family:${FONT_DISPLAY};font-weight:800;font-size:38px;color:${COLORS.accent};letter-spacing:-0.025em;line-height:1;">${formatARS(totalNet)}</div>
          <div style="font-size:12.5px;color:${COLORS.textSecondary};margin-top:6px;">de ${formatARS(totalGross)} totales · acreditado en MP</div>
        </td>
      </tr>
    </table>

    <div style="font-family:${FONT_MONO};font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:${COLORS.textTertiary};margin:18px 0 8px;">Detalle</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:22px;">
      ${rows}
    </table>

    ${ctaButton("Ver todas mis ventas", `${env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, "")}/dashboard/ventas`)}
  `;

  return layout({
    preheader: `${count} ventas nuevas · ${formatARS(totalNet)} netos · estás en racha`,
    body,
  });
}

/* ============================================================================
 * 4) Password reset
 * ========================================================================= */

export type PasswordResetEmailInput = {
  name: string;
  resetUrl: string;
};

export function passwordResetEmailHtml(input: PasswordResetEmailInput): string {
  const firstName = input.name.split(" ")[0] || "Hola";
  const body = `
    ${eyebrow("Reset de contraseña")}
    ${heading(`${firstName}, ¿pediste reset?`)}
    ${paragraph(
      `Alguien pidió cambiar la contraseña de tu cuenta de cuervito. Si fuiste vos, dale al botón. El link expira en 1 hora.`,
    )}

    <div style="margin:22px 0 24px;">
      ${ctaButton("Crear nueva contraseña", input.resetUrl)}
    </div>

    <div bgcolor="${COLORS.bgElevated}" class="cv-elevated" style="padding:14px 16px;background:${COLORS.bgElevated};border:1px solid ${COLORS.border};border-radius:10px;font-size:13px;color:${COLORS.textSecondary};line-height:1.55;">
      <div style="font-family:${FONT_MONO};font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:${COLORS.warning};margin-bottom:6px;">¿No fuiste vos?</div>
      Ignorá este mail. Tu cuenta sigue protegida con la contraseña actual. Solo quien tenga acceso a este mail puede usar el link.
    </div>

    <p style="margin:22px 0 0;font-size:12.5px;color:${COLORS.textTertiary};line-height:1.5;word-break:break-all;">
      Si el botón no funciona:<br>
      <span style="color:${COLORS.textSecondary};">${input.resetUrl}</span>
    </p>
  `;

  return layout({
    preheader: "Cambiá tu contraseña — el link vence en 1 hora.",
    body,
  });
}

/* ============================================================================
 * Back-compat: keep the old export name used by the resend-email API.
 * ========================================================================= */

/** @deprecated use deliveryEmailHtml */
export function downloadEmailHtml(opts: {
  buyerName: string;
  eventName: string;
  photoCount: number;
  downloadUrl: string;
}): string {
  return deliveryEmailHtml(opts);
}
