/**
 * Canal de soporte. Estaba hardcodeado en el panel de ayuda y con el link
 * vacío en la comparativa, así que vive acá y se usa desde los dos lados.
 */
export const SUPPORT_WHATSAPP = "5493541578953";

export function whatsappUrl(text?: string): string {
  const base = `https://wa.me/${SUPPORT_WHATSAPP}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}
