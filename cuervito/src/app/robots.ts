import { type MetadataRoute } from "next";

import { SITIO } from "~/lib/marca";

/**
 * Lo que no es para buscadores: el panel, las cuentas, y todo lo que lleva un
 * token en la dirección. Una página de descarga indexada es la compra de
 * alguien a la vista de cualquiera.
 *
 * Esto sólo pide que no se rastree. Lo que de verdad saca una página del
 * índice es el noindex de su propio <head>, y las privadas lo tienen también.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/dashboard",
        "/admin",
        "/api/",
        "/onboarding",
        "/suspended",
        "/descarga/",
        "/pago/",
        "/invitacion/",
        "/correos/",
        "/reset-password/",
      ],
    },
    sitemap: `${SITIO}/sitemap.xml`,
  };
}
