/**
 * Los textos de las plantillas son HTML chico (<em>, <strong>, <br/>). En el
 * editor se escriben con marcas de texto, que es lo que un fotógrafo ya usa
 * en WhatsApp: *cursiva*, **negrita** y un Enter para cortar la línea.
 *
 * Estas dos funciones van y vuelven. Lo que se guarda pasa además por el
 * saneador del servidor (dashboard/portfolio/_sanear.ts), que es el que
 * manda: esto es comodidad, no seguridad.
 */

const ENTIDADES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " " };

export function htmlAMarcas(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<(strong|b)>([\s\S]*?)<\/\1>/gi, "**$2**")
    .replace(/<(em|i)>([\s\S]*?)<\/\1>/gi, "*$2*")
    .replace(/<[^>]+>/g, "")
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m) => ENTIDADES[m] ?? m);
}

export function marcasAHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*\n]+)\*/g, "<em>$1</em>")
    .replace(/\r?\n/g, "<br/>");
}
