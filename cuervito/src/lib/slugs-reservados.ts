/**
 * Los slugs que no puede tener un fotógrafo, porque son rutas nuestras.
 *
 * La tienda vive en /{slug} y una ruta fija le gana siempre a la dinámica: un
 * fotógrafo que quedaba con el slug "demo" o "eventos" tenía una tienda a la
 * que no se podía entrar, y nadie se enteraba. El registro arma el slug solo a
 * partir del nombre, así que alcanzaba con llamarse así.
 *
 * La usan los que asignan slugs (registro, onboarding, perfil), las páginas
 * de la tienda —que cortan antes de ir a la base— y el sitemap.
 *
 * Al sumar una carpeta en src/app (o en public/) hay que sumarla acá. También
 * hay nombres que todavía no son rutas pero van a serlo: reservarlos ahora es
 * gratis, sacarle el slug a alguien después no.
 */
export const SLUGS_RESERVADOS: ReadonlySet<string> = new Set([
  // Rutas de src/app
  "admin", "api", "comparativa", "correos", "dashboard", "demo", "descarga",
  "eventos", "invitacion", "onboarding", "pago", "suspended",
  "login", "signup", "forgot-password", "reset-password",
  "privacidad", "terminos", "vista-portfolio",
  // Carpetas de public/
  "assets", "hero", "marca",
  // Archivos y rutas de Next
  "_next", "_components", "favicon.ico", "robots.txt", "sitemap.xml",
  "llms.txt", "llms-full.txt",
  // Las que vienen
  "blog", "ayuda", "precios", "fotografos", "guias",
]);

export function slugReservado(slug: string): boolean {
  return SLUGS_RESERVADOS.has(slug.toLowerCase());
}
