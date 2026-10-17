import { buildTemplateCSSOverride, getTemplate } from "~/lib/storefront-templates";
import { FUENTES_PLANTILLA } from "~/styles/v2/fuentes-plantillas";

/**
 * Las variables de la plantilla —colores y, si tiene tema, tipografías— como
 * un <style> sobre :root, para que el fondo del <body> y lo que se monta
 * fuera de la página ya estén bien antes del primer pintado.
 *
 * Es una pieza aparte, sin hojas de estilo propias, porque la usan tres
 * lugares: la cabeza de la tienda (_cabeza.tsx), la previa del panel —que la
 * vuelve a poner con los colores que el fotógrafo está probando, y como viene
 * después en el documento, gana— y la entrega (/descarga), que no pasa por
 * la cabeza y trae sus propias hojas.
 */
export function EstiloPlantilla({
  plantilla,
  color,
  color2,
}: {
  plantilla: string | null;
  color: string | null;
  color2?: string | null;
}) {
  const tpl = getTemplate(plantilla);
  let css = buildTemplateCSSOverride(plantilla, color, color2);
  if (tpl.tema) {
    const sans = FUENTES_PLANTILLA[tpl.tema.fuentes.sans].style.fontFamily;
    const display = FUENTES_PLANTILLA[tpl.tema.fuentes.display].style.fontFamily;
    css += `\n:root {\n  --fuente-plantilla-sans: ${sans};\n  --fuente-plantilla-display: ${display};\n}`;
  }
  return css ? <style dangerouslySetInnerHTML={{ __html: css }} /> : null;
}
