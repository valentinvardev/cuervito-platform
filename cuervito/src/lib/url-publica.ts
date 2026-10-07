import { SITIO } from "~/lib/marca";

/**
 * La dirección con la que Google tiene que conocer una página del fotógrafo.
 *
 * Con dominio propio, la tienda responde en dos lados: anafoto.com.ar/x y
 * encontrate.app/ana-liotta/x. Sin un canonical, Google elige uno solo, y
 * puede elegir el nuestro: el fotógrafo que pagó un dominio para que lo
 * encuentren por su marca terminaría compitiendo contra sí mismo. Por eso,
 * si tiene dominio activo, la canónica es la suya.
 */
export function urlPublica(
  slug: string,
  dominio: string | null | undefined,
  ruta = "",
): string {
  return dominio ? `https://${dominio}/${ruta}` : `${SITIO}/${slug}${ruta ? `/${ruta}` : ""}`;
}
