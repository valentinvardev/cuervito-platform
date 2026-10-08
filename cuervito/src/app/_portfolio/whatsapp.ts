/** Fill the owner's WhatsApp template with a contact-form submission.
 *  Supports {name} {email} {message}; when the template has no placeholders the
 *  details are appended so the owner still receives who wrote and what. */
export function fillWaTemplate(tpl: string, v: { name: string; email: string; message: string }) {
  const hasVars = /\{(name|email|message)\}/i.test(tpl);
  let t = (tpl || "").replace(/\{name\}/gi, v.name).replace(/\{email\}/gi, v.email).replace(/\{message\}/gi, v.message);
  if (!hasVars) {
    const who = [v.name, v.email].filter(Boolean).join(" · ");
    t = [t.trim(), who, v.message].filter(Boolean).join("\n\n");
  }
  return t.trim() || v.message;
}

/** Un campo de texto del formulario de contacto, recortado ("" si falta). */
export function campo(fd: FormData, nombre: string): string {
  const v = fd.get(nombre);
  return typeof v === "string" ? v.trim() : "";
}
