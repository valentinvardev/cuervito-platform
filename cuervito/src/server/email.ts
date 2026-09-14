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

/**
 * Lo que el notificador de ventas le pasa a las plantillas. Vive acá, al lado
 * del envío, porque es el contrato entre quien arma el aviso y quien lo dibuja.
 */
export type SaleItemSummary = {
  eventName: string;
  itemCount: number;
  totalCents: number;
  sellerNetCents: number;
  buyerName: string | null;
  paidAt: string; // ISO
};

/* Acá abajo vivían las plantillas oscuras de cuervito —bienvenida, entrega,
   ventas, contraseña, invitación— con su propia paleta y su propia fuente.
   Se borraron con el rebrand: la marca es una y el juego de plantillas es
   email-encontrate.ts. Dos juegos son dos estilos que se separan solos. */
