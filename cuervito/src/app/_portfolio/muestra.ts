import type { FotoSitio } from "./store";

/**
 * Fotos de muestra para la vista de las plantillas.
 *
 * Con dos o tres fotos, una plantilla pensada para una temporada entera se ve
 * vacía y el fotógrafo no puede juzgarla. Si eligió menos de MINIMO, la vista
 * (/vista-portfolio) se completa con éstas, que viven en /public y no se
 * guardan en ningún portfolio: la página pública nunca las usa.
 *
 * Son imágenes generadas, sin personas reconocibles ni marcas, repartidas en
 * tres «eventos» inventados para que las plantillas que agrupan por evento
 * muestren más de una serie.
 */
export const MINIMO_FOTOS_VISTA = 5;

const TRAIL = { group: "Trail de las Cumbres", date: "2026-04-12" };
const BICI = { group: "Rural Bike del Valle", date: "2026-05-03" };
const CALLE = { group: "Maratón de la Costa", date: "2026-06-21" };

export const FOTOS_MUESTRA: FotoSitio[] = [
  { src: "/portfolio-muestra/01.webp", title: "Cresta al amanecer", ...TRAIL },
  { src: "/portfolio-muestra/02.webp", title: "Vadeo", ...BICI },
  { src: "/portfolio-muestra/03.webp", title: "Pelotón", ...BICI },
  { src: "/portfolio-muestra/04.webp", title: "Largada", ...CALLE },
  { src: "/portfolio-muestra/05.webp", title: "Calle mojada", ...CALLE },
  { src: "/portfolio-muestra/06.webp", title: "Bajada", ...TRAIL },
  { src: "/portfolio-muestra/07.webp", title: "Subida", ...BICI },
  { src: "/portfolio-muestra/08.webp", title: "Contraluz", ...TRAIL },
];

/** Las fotos propias, y si son pocas, las de muestra detrás. */
export function conMuestra(fotos: FotoSitio[]): FotoSitio[] {
  return fotos.length >= MINIMO_FOTOS_VISTA ? fotos : [...fotos, ...FOTOS_MUESTRA];
}
