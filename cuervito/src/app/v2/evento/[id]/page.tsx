import { notFound } from "next/navigation";

import { env } from "~/env";
import { db } from "~/server/db";
import { resolveMediaUrl } from "~/server/media";

import { pesos, sesionV2 } from "../../_components/sesion";
import { Pantalla } from "./_pantalla";

export const dynamic = "force-dynamic";

// Techo de fotos que se traen. La grilla pagina de a 20, pero el filtro y la
// búsqueda por dorsal trabajan sobre el conjunto, así que hace falta tenerlo
// en memoria. Con más que esto conviene mover el filtrado al servidor.
const TOPE = 600;

export default async function V2Evento({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId, slug } = await sesionV2();

  const e = await db.event.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      name: true,
      location: true,
      discipline: true,
      description: true,
      eventDate: true,
      coverUrl: true,
      isPublished: true,
      pricePerPhoto: true,
      ownerId: true,
      sales: { where: { status: "PAID" }, select: { sellerNetCents: true } },
      collaborators: {
        select: {
          invitedEmail: true,
          status: true,
          user: { select: { id: true, name: true, mpConnectedAt: true } },
        },
      },
    },
  });
  if (e?.ownerId !== userId) notFound();

  // Los tres conteos van al servidor y no se sacan del arreglo de fotos: ese
  // está topeado en TOPE, así que en un evento grande contar sobre él daría
  // "580 de 580" cuando hay 3.000.
  const [fotos, total, reconocidas, conDorsal, vendidasIds] = await Promise.all([
    db.photo.findMany({
      where: { eventId: id, deletedAt: null, fileSize: { not: null } },
      orderBy: { createdAt: "desc" },
      take: TOPE,
      select: { id: true, bibNumbers: true, previewKey: true, previewCleanKey: true, ocrProcessedAt: true },
    }),
    // Con el mismo filtro que el resto. _count.photos de la relación incluye
    // las borradas, así que el total salía más alto que sus propias partes.
    db.photo.count({ where: { eventId: id, deletedAt: null } }),
    db.photo.count({ where: { eventId: id, deletedAt: null, ocrProcessedAt: { not: null } } }),
    db.photo.count({
      where: {
        eventId: id,
        deletedAt: null,
        AND: [{ bibNumbers: { not: null } }, { bibNumbers: { not: "" } }],
      },
    }),
    db.saleItem.findMany({
      where: { sale: { eventId: id, status: "PAID" } },
      select: { photoId: true },
    }),
  ]);

  const vendidas = new Set(vendidasIds.map((v) => v.photoId));

  const conUrl = await Promise.all(
    fotos.map(async (f) => ({
      id: f.id,
      url: await resolveMediaUrl(f.previewCleanKey ?? f.previewKey ?? "").catch(() => null),
      bib: f.bibNumbers,
      vendida: vendidas.has(f.id),
      reconocida: f.ocrProcessedAt !== null,
    })),
  );

  const colaboradores = await Promise.all(
    e.collaborators.map(async (c) => ({
      nombre: c.user?.name ?? c.invitedEmail.split("@")[0]!,
      email: c.invitedEmail,
      estado: c.status,
      fotos: c.user
        ? await db.photo.count({ where: { eventId: id, ownerId: c.user.id, deletedAt: null } })
        : 0,
      cobra: !!c.user?.mpConnectedAt,
    })),
  );

  const cover = e.coverUrl
    ? e.coverUrl.startsWith("http")
      ? e.coverUrl
      : await resolveMediaUrl(e.coverUrl).catch(() => null)
    : null;

  return (
    <Pantalla
      evento={{
        id: e.id,
        nombre: e.name,
        fecha: e.eventDate
          ? e.eventDate.toLocaleDateString("es-AR", { day: "numeric", month: "long" })
          : null,
        lugar: e.location,
        disciplina: e.discipline,
        portada: cover,
        publicado: e.isPublished,
        // pricePerPhoto es Decimal(10,2) en PESOS, no en centavos.
        precio: Number(e.pricePerPhoto),
        comision: env.PLATFORM_FEE_PERCENT,
        descripcion: e.description,
        total,
        reconocidas,
        conDorsal,
        ventas: e.sales.length,
        recaudado: pesos(e.sales.reduce((a, s) => a + s.sellerNetCents, 0)),
      }}
      fotos={conUrl}
      colaboradores={colaboradores}
      publico={e.isPublished && e.slug ? `/${slug}/${e.slug}` : null}
    />
  );
}
