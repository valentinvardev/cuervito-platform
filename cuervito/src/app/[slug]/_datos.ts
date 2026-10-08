import "server-only";

import { cache } from "react";

import { slugReservado } from "~/lib/slugs-reservados";
import { db } from "~/server/db";

/**
 * El fotógrafo y el evento de la tienda, una consulta por request.
 *
 * Los piden los layouts y las páginas de /[slug] y /[slug]/[eventSlug], y
 * también sus generateMetadata. Con cache() la base se consulta una vez.
 *
 * Que los LAYOUTS los pidan no es redundante: es lo que hace que una tienda o
 * un evento que no existen respondan 404. La página corre adentro de un
 * <Suspense> (el del layout de la tienda, el loading.tsx del evento), y para
 * cuando la página llama a notFound() el 200 ya salió. El layout corre antes
 * de ese límite: si decide ahí, el código de estado todavía se puede elegir.
 */

export const traerFotografo = cache(async (slug: string) => {
  if (slugReservado(slug)) return null;
  const u = await db.user.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      bio: true,
      location: true,
      instagramUrl: true,
      websiteUrl: true,
      image: true,
      storefrontBrandColor: true,
      storefrontTemplate: true,
      logoKey: true,
      status: true,
      onboardingCompletedAt: true,
      giftEnabled: true,
      customDomains: {
        where: { status: "ACTIVE" },
        orderBy: { verifiedAt: "asc" },
        take: 1,
        select: { hostname: true },
      },
    },
  });
  // Suspendido, borrado o a mitad del onboarding: para afuera no existe.
  if (u?.status !== "ACTIVE" || !u.onboardingCompletedAt) return null;
  return u;
});

export type Fotografo = NonNullable<Awaited<ReturnType<typeof traerFotografo>>>;

/**
 * El evento, PUBLICADO O NO. Quién decide qué mostrar es la página: uno
 * publicado se vende, uno sin publicar muestra el aviso de evento privado.
 * Que no exista es lo único que es un 404.
 */
export const traerEvento = cache((ownerId: string, eventSlug: string) =>
  db.event.findFirst({
    where: { slug: eventSlug, ownerId },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      discipline: true,
      location: true,
      eventDate: true,
      coverUrl: true,
      pricePerPhoto: true,
      currency: true,
      recognition: true,
      isPublished: true,
      status: true,
      // Si el evento no lee dorsales, la tienda no ofrece buscar por dorsal:
      // mandar a escribir un número que no va a encontrar nada es peor que no
      // ofrecerlo.
      bibDetection: true,
    },
  }),
);

export type Evento = NonNullable<Awaited<ReturnType<typeof traerEvento>>>;

/** A la venta: publicado y no archivado. Lo demás es la página de privado. */
export function estaALaVenta(e: Pick<Evento, "isPublished" | "status">): boolean {
  return e.isPublished && e.status !== "ARCHIVED";
}
