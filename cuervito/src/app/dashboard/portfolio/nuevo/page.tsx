import { db } from "~/server/db";
import { resolveMediaUrl } from "~/server/media";

import { sesionPortfolio } from "../_acceso";
import { Asistente, type EventoParaElegir } from "./_asistente";

export const dynamic = "force-dynamic";

export const metadata = { title: "Nuevo portfolio" };

/**
 * El asistente de creación: nombre → fotos → plantilla → listo. Es una página
 * propia (y no un diálogo) para que el botón de atrás del navegador y el link
 * directo funcionen.
 */
export default async function NuevoPortfolio() {
  const { userId, slug } = await sesionPortfolio();

  const eventos = await db.event.findMany({
    where: { ownerId: userId, photos: { some: { deletedAt: null, previewCleanKey: { not: null } } } },
    orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }],
    take: 60,
    select: {
      id: true,
      name: true,
      discipline: true,
      eventDate: true,
      coverUrl: true,
      _count: { select: { photos: { where: { deletedAt: null } } } },
      photos: {
        where: { deletedAt: null, thumbKey: { not: null } },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { thumbKey: true },
      },
    },
  });

  const lista: EventoParaElegir[] = await Promise.all(
    eventos.map(async (e) => {
      const tapa = e.photos[0]?.thumbKey ?? e.coverUrl;
      return {
        id: e.id,
        nombre: e.name,
        disciplina: e.discipline,
        fecha: e.eventDate?.toISOString().slice(0, 10) ?? null,
        fotos: e._count.photos,
        tapa: tapa ? await resolveMediaUrl(tapa) : null,
      };
    }),
  );

  return <Asistente eventos={lista} slugFotografo={slug} />;
}
