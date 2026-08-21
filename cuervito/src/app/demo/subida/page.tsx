import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { env } from "~/env";
import { db } from "~/server/db";
import { resolveMediaUrl } from "~/server/media";

import { pesos, sesionV2 } from "~/app/v2/_components/sesion";
import { Subida } from "./_subida";

/**
 * La demo grabable de la subida, en el panel del evento.
 *
 * Se abre en /demo/subida y listo, igual que la de la compra: sin parámetros
 * para poder tipearla en el teléfono sin errores en medio de una grabación.
 *
 * Muestra el panel de un evento REAL —el que más fotos tenga de los propios—
 * arrancando vacío: se suelta el álbum, se sube, y las fotos van apareciendo y
 * reconociéndose. El álbum es preexistente en el sentido de que las fotos ya
 * están en S3: la demo no sube ni crea nada, sólo las va revelando.
 *
 * A diferencia de /demo/compra, ACÁ SÍ HACE FALTA SESIÓN. El panel del evento
 * muestra lo recaudado, las ventas y los mails de los colaboradores. Sin este
 * control, la dirección sería una filtración de datos de un fotógrafo con sólo
 * saber que existe.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Demo · Subida",
};

export const dynamic = "force-dynamic";

/** Cuántas fotos entran en la demo. Con POR_PAG = 20, alcanzan para dos páginas. */
const TOPE = 32;

export default async function DemoSubida() {
  const { userId, slug, nombre } = await sesionV2();

  // El evento propio con más fotos listas. Elegirlo así y no fijarlo por id
  // evita que la demo quede rota el día que ese evento se archive, y que haya
  // que tocar código para grabar con otro.
  const e = await db.event.findFirst({
    where: {
      ownerId: userId,
      NOT: { status: "ARCHIVED" },
      photos: { some: { deletedAt: null, previewGeneratedAt: { not: null } } },
    },
    // Por cantidad de fotos y no por fecha: el último evento puede tener una
    // sola foto, y una demo de subida con una foto no muestra nada.
    orderBy: { photos: { _count: "desc" } },
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
  if (!e) notFound();

  const crudas = await db.photo.findMany({
    where: {
      eventId: e.id,
      deletedAt: null,
      fileSize: { not: null },
      previewGeneratedAt: { not: null },
    },
    orderBy: { createdAt: "desc" },
    take: TOPE,
    select: {
      id: true,
      filename: true,
      bibNumbers: true,
      previewKey: true,
      previewCleanKey: true,
      _count: { select: { faceRecords: true } },
    },
  });
  if (crudas.length === 0) notFound();

  const fotos = await Promise.all(
    crudas.map(async (f) => ({
      id: f.id,
      url: await resolveMediaUrl(f.previewCleanKey ?? f.previewKey ?? "").catch(() => null),
      bib: f.bibNumbers,
      // Sin ventas: en la demo estas fotos se acaban de subir, y una recién
      // subida no puede estar vendida. Con el cartelito de vendida encima
      // contaría otra historia.
      vendida: false,
      ventas: 0,
      // Si el evento no llegó a indexar caras, se inventa un número para que el
      // icono de reconocimiento tenga algo que decir en el video. Es el único
      // dato fabricado de la pantalla.
      caras: f._count.faceRecords || 1 + (f.id.charCodeAt(0) % 3),
      reconocida: true,
    })),
  );

  const colaboradores = await Promise.all(
    e.collaborators.map(async (c) => ({
      nombre: c.user?.name ?? c.invitedEmail.split("@")[0]!,
      email: c.invitedEmail,
      estado: c.status,
      fotos: c.user
        ? await db.photo.count({ where: { eventId: e.id, ownerId: c.user.id, deletedAt: null } })
        : 0,
      cobra: !!c.user?.mpConnectedAt,
    })),
  );

  const fotosDelDueno = await db.photo.count({
    where: { eventId: e.id, ownerId: userId, deletedAt: null },
  });

  const cover = e.coverUrl
    ? e.coverUrl.startsWith("http")
      ? e.coverUrl
      : await resolveMediaUrl(e.coverUrl).catch(() => null)
    : null;

  return (
    <Subida
      evento={{
        id: e.id,
        nombre: e.name,
        fecha: e.eventDate
          ? e.eventDate.toLocaleDateString("es-AR", { day: "numeric", month: "long" })
          : null,
        fechaISO: e.eventDate ? e.eventDate.toISOString().slice(0, 10) : null,
        lugar: e.location,
        disciplina: e.discipline,
        portada: cover,
        publicado: e.isPublished,
        precio: Number(e.pricePerPhoto),
        comision: e.platformFeePct !== null ? Number(e.platformFeePct) : env.PLATFORM_FEE_PERCENT,
        reconocimiento: e.recognition,
        leeDorsales: e.bibDetection,
        maxFoto: env.QUOTA_MAX_PHOTO_BYTES,
        descripcion: e.description,
        // Los tres conteos los maneja el guion: arrancan en cero y suben a
        // medida que la demo revela las fotos.
        total: 0,
        reconocidas: 0,
        conDorsal: 0,
        ventas: e.sales.length,
        recaudado: pesos(e.sales.reduce((a, s) => a + s.sellerNetCents, 0)),
      }}
      fotos={fotos}
      colaboradores={colaboradores}
      publico={e.isPublished && e.slug ? `/${slug}/${e.slug}` : null}
      yo={nombre}
      fotosDelDueno={fotosDelDueno}
    />
  );
}
