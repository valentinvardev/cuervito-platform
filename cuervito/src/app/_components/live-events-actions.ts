"use server";

import { db } from "~/server/db";
import { resolveMediaUrl, urlDerivado } from "~/server/media";

export type LiveEvent = {
  href: string;
  name: string;
  date: string | null;
  location: string | null;
  photos: number;
  coverUrl: string | null;
};

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export async function searchLiveEvents(query: string): Promise<LiveEvent[]> {
  const q = normalize(query.trim());

  const events = await db.event.findMany({
    where: {
      isPublished: true,
      NOT: { status: "ARCHIVED" },
      // Sólo eventos que se pueden abrir: la página del evento da 404 si el
      // fotógrafo no está activo o no tiene la tienda habilitada, y mostrar
      // la tarjeta igual es mandar al atleta a una página rota.
      owner: { status: "ACTIVE", onboardingCompletedAt: { not: null }, slug: { not: null } },
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { location: { contains: q, mode: "insensitive" } },
              { discipline: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }],
    take: 12,
    select: {
      slug: true,
      name: true,
      eventDate: true,
      location: true,
      coverUrl: true,
      owner: { select: { slug: true } },
      _count: { select: { photos: { where: { fileSize: { not: null }, deletedAt: null } } } },
      photos: {
        where: { previewKey: { not: null }, deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { previewKey: true, previewGeneratedAt: true },
      },
    },
  });

  const results = await Promise.all(
    events.map(async (e) => {
      // Sin portada subida, la primera foto: ésa lleva marca y va con su versión.
      const foto = e.photos[0];
      let coverUrl: string | null = null;
      try {
        if (e.coverUrl) {
          coverUrl = e.coverUrl.startsWith("http") ? e.coverUrl : await resolveMediaUrl(e.coverUrl);
        } else if (foto?.previewKey) {
          coverUrl = await urlDerivado(foto.previewKey, foto.previewGeneratedAt);
        }
      } catch {
        coverUrl = null;
      }
      return {
        // ?src=search marca que el descubrimiento lo aportó el buscador
        // de Cuervito, no el link que compartió el fotógrafo.
        href: e.owner.slug ? `/${e.owner.slug}/${e.slug}?src=search` : `#`,
        name: e.name,
        date: e.eventDate
          ? new Date(e.eventDate).toLocaleDateString("es-AR", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })
          : null,
        location: e.location,
        photos: e._count.photos,
        coverUrl,
      };
    }),
  );
  return results;
}
