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
  const { userId, slug, nombre } = await sesionV2();

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
      platformFeePct: true,
      recognition: true,
      bibDetection: true,
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
      select: {
        id: true,
        bibNumbers: true,
        previewKey: true,
        previewCleanKey: true,
        ocrProcessedAt: true,
        // Las caras indexadas de cada foto. Es lo que se muestra al pasar el
        // mouse, y es el dato que dice si esa foto la va a encontrar alguien:
        // una foto sin caras existe en la galería y no aparece en ninguna
        // búsqueda por selfie.
        _count: { select: { faceRecords: true } },
      },
    }),
    // Los tres con EXACTAMENTE el mismo filtro que la grilla, incluido
    // fileSize: una fila sin tamaño es una subida que se firmó y nunca llegó, y
    // no es una foto: no se ve, no se puede vender y no se va a reconocer
    // nunca. Contándolas, un evento de 12 fotos decía "12 de 15 reconocidas" y
    // se quedaba ahí para siempre, porque esas tres no existen.
    db.photo.count({ where: { eventId: id, deletedAt: null, fileSize: { not: null } } }),
    db.photo.count({
      where: {
        eventId: id,
        deletedAt: null,
        fileSize: { not: null },
        ocrProcessedAt: { not: null },
      },
    }),
    db.photo.count({
      where: {
        eventId: id,
        deletedAt: null,
        fileSize: { not: null },
        AND: [{ bibNumbers: { not: null } }, { bibNumbers: { not: "" } }],
      },
    }),
    db.saleItem.findMany({
      where: { sale: { eventId: id, status: "PAID" } },
      select: { photoId: true },
    }),
  ]);

  // Cuántas veces se vendió cada foto, no sólo si se vendió: una foto que
  // compraron seis personas es la que conviene mirar para saber qué funciona.
  const ventasPorFoto = new Map<string, number>();
  for (const v of vendidasIds) {
    if (v.photoId) ventasPorFoto.set(v.photoId, (ventasPorFoto.get(v.photoId) ?? 0) + 1);
  }

  const conUrl = await Promise.all(
    fotos.map(async (f) => ({
      id: f.id,
      url: await resolveMediaUrl(f.previewCleanKey ?? f.previewKey ?? "").catch(() => null),
      bib: f.bibNumbers,
      vendida: (ventasPorFoto.get(f.id) ?? 0) > 0,
      ventas: ventasPorFoto.get(f.id) ?? 0,
      caras: f._count.faceRecords,
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

  // El dueño también sube fotos, y hasta ahora la tabla del equipo decía
  // "4 fotógrafos" pero listaba tres: el que faltaba era el que estaba mirando.
  const fotosDelDueno = await db.photo.count({
    where: { eventId: id, ownerId: userId, deletedAt: null },
  });

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
        // En UTC y no con toISOString sobre la fecha local: el evento se guarda
        // a medianoche UTC, así que en Argentina (-3) la fecha local del día
        // anterior, y el campo mostraba un día menos cada vez que se abría.
        fechaISO: e.eventDate ? e.eventDate.toISOString().slice(0, 10) : null,
        lugar: e.location,
        disciplina: e.discipline,
        portada: cover,
        publicado: e.isPublished,
        // pricePerPhoto es Decimal(10,2) en PESOS, no en centavos.
        precio: Number(e.pricePerPhoto),
        // La del evento. Los creados antes de que existiera la columna la
        // tienen en null y siguen con la global.
        comision: e.platformFeePct !== null ? Number(e.platformFeePct) : env.PLATFORM_FEE_PERCENT,
        reconocimiento: e.recognition,
        leeDorsales: e.bibDetection,
        maxFoto: env.QUOTA_MAX_PHOTO_BYTES,
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
      yo={nombre}
      fotosDelDueno={fotosDelDueno}
    />
  );
}
