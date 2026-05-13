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

export function downloadEmailHtml(opts: {
  buyerName: string;
  eventName: string;
  photoCount: number;
  downloadUrl: string;
}): string {
  return `<!doctype html>
<html><body style="background:#0f0d0b;color:#f0ebe3;font-family:'DM Sans',system-ui,sans-serif;margin:0;padding:0;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0d0b;padding:32px 16px;">
  <tr><td align="center">
    <table cellpadding="0" cellspacing="0" width="520" style="background:#1a1614;border:1px solid #2e2823;border-radius:14px;padding:32px;">
      <tr><td>
        <div style="font-family:'Bricolage Grotesque',serif;font-weight:800;font-size:22px;color:#f5820a;letter-spacing:-0.02em;margin-bottom:24px;">cuervito</div>
        <h1 style="font-family:'Bricolage Grotesque',serif;font-weight:800;font-size:28px;line-height:1.15;letter-spacing:-0.02em;margin:0 0 12px;">¡Gracias por tu compra, ${escapeHtml(opts.buyerName)}!</h1>
        <p style="color:#a89e8f;font-size:15px;line-height:1.55;margin:0 0 24px;">
          Tus <strong style="color:#f0ebe3;">${opts.photoCount} ${opts.photoCount === 1 ? "foto" : "fotos"}</strong> del evento
          <strong style="color:#f0ebe3;">${escapeHtml(opts.eventName)}</strong> están listas para descargar.
        </p>
        <a href="${opts.downloadUrl}" style="display:inline-block;background:#f5820a;color:#1a0d00;font-weight:600;text-decoration:none;padding:14px 26px;border-radius:10px;font-size:15px;">
          Descargar mis fotos
        </a>
        <p style="color:#6e6557;font-size:12.5px;margin-top:28px;line-height:1.5;">
          El link es personal y válido por 72 horas. Si no podés abrirlo, copialo y pegalo en tu navegador:<br>
          <span style="word-break:break-all;color:#a89e8f;">${opts.downloadUrl}</span>
        </p>
      </td></tr>
    </table>
    <div style="color:#6e6557;font-size:11.5px;margin-top:18px;">cuervito · venta de fotos deportivas</div>
  </td></tr>
</table>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  );
}
