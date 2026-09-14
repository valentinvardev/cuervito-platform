import "server-only";

import * as encontrate from "./email-encontrate";

/**
 * Qué juego de plantillas de mail usar. Hoy: uno solo.
 *
 * Durante el rebrand hubo dos —el de cuervito, oscuro, y el de encontrate—
 * y esto elegía según la plantilla de la tienda del fotógrafo, para que el
 * comprador recibiera un mail parecido a la página donde compró. Ese período
 * terminó: la marca es una, el papel es uno, y las plantillas oscuras se
 * borraron para que no hubiera dos estilos que mantener.
 *
 * La función se queda con su nombre y su parámetro para no tocar los siete
 * lugares que la llaman. Si algún día vuelve a haber dos juegos, la decisión
 * vive acá y en ningún otro lado.
 */
export function mailsDe(_storefrontTemplate: string | null | undefined) {
  return encontrate;
}
