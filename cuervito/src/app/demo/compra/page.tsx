import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { buildTemplateStyle } from "~/lib/storefront-templates";
import { resolveAvatarUrl } from "~/server/avatar";
import { db } from "~/server/db";
import { resolveMediaUrl } from "~/server/media";
import { getPresignedDownloadUrl } from "~/server/s3";

import { Demo } from "./_demo";

/**
 * La demo grabable de la compra.
 *
 * Se abre en /demo/compra y listo: la dirección no lleva parámetros para poder
 * tipearla en el teléfono sin errores en medio de una grabación. El evento lo
 * elige la propia página — el publicado más reciente que tenga fotos
 * procesadas.
 *
 * Usa un evento REAL y sus fotos: una demo con rectángulos grises no sirve para
 * mostrar un producto que vende fotos.
 *
 * No pide sesión porque no muestra nada que no esté ya público en la tienda del
 * fotógrafo. Sí lleva noindex: es una pantalla de trabajo, no algo que tenga
 * que aparecer en una búsqueda.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Demo",
};

export const dynamic = "force-dynamic";

const TOPE = 24;

export default async function DemoCompra() {
  // El evento más reciente que esté publicado y tenga fotos listas para mostrar.
  // Buscarlo así y no fijarlo por id evita que la demo se rompa el día que ese
  // evento se archive.
  const evento = await db.event.findFirst({
    where: {
      isPublished: true,
      NOT: { status: "ARCHIVED" },
      owner: { status: "ACTIVE" },
      photos: { some: { deletedAt: null, previewGeneratedAt: { not: null } } },
    },
    orderBy: { createdAt: "desc" },
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
      bibDetection: true,
      owner: {
        select: {
      id: true,
      name: true,
      bio: true,
      location: true,
      instagramUrl: true,
      image: true,
      logoKey: true,
          storefrontBrandColor: true,
          slug: true,
        },
      },
    },
  });
  if (!evento) notFound();

  const fotografo = evento.owner;
  const slug = fotografo.slug ?? "";

  const crudas = await db.photo.findMany({
    where: {
      eventId: evento.id,
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
      width: true,
      height: true,
      storageKey: true,
      previewKey: true,
      previewCleanKey: true,
    },
  });
  if (crudas.length === 0) notFound();

  // El dorsal del guion: se toma el de la primera foto que tenga uno, así la
  // búsqueda del video encuentra algo de verdad en vez de quedar en cero.
  const dorsalDemo =
    crudas.find((p) => p.bibNumbers?.trim())?.bibNumbers?.split(",")[0]?.trim() ?? null;

  const fotos = await Promise.all(
    crudas.map(async (p) => ({
      id: p.id,
      filename: p.filename,
      bibNumbers: p.bibNumbers,
      width: p.width,
      height: p.height,
      // Dos URLs por foto, porque la demo pasa por las dos pantallas y cada una
      // muestra una versión distinta de la misma foto.
      //
      // La vitrina va MARCADA: es lo que ve alguien que todavía no pagó.
      previewUrl: p.previewKey
        ? await resolveMediaUrl(p.previewKey)
        : await getPresignedDownloadUrl(p.storageKey, { expiresIn: 60 * 30 }),
      // La entrega va LIMPIA. Antes reusaba la de la vitrina y en el video el
      // comprador terminaba mirando su propia compra con la marca de agua
      // encima, que es exactamente lo que acababa de pagar por sacarse. Misma
      // cascada que la entrega de verdad: limpia, marcada, y el original.
      // La demo no usa la miniatura chica de la tienda: son treinta fotos y
      // el visor tiene que abrir la misma imagen que la grilla.
      fullUrl: p.previewKey
        ? await resolveMediaUrl(p.previewKey)
        : await getPresignedDownloadUrl(p.storageKey, { expiresIn: 60 * 30 }),
      limpiaUrl: p.previewCleanKey
        ? await resolveMediaUrl(p.previewCleanKey)
        : p.previewKey
          ? await resolveMediaUrl(p.previewKey)
          : await getPresignedDownloadUrl(p.storageKey, { expiresIn: 60 * 30 }),
    })),
  );

  const [avatarUrl, logoUrl] = await Promise.all([
    resolveAvatarUrl(fotografo.image),
    fotografo.logoKey ? resolveMediaUrl(fotografo.logoKey) : null,
  ]);

  const iniciales =
    (fotografo.name ?? "")
      .split(" ")
      .map((p) => p[0]?.toUpperCase() ?? "")
      .filter(Boolean)
      .slice(0, 2)
      .join("") || "?";

  // La demo se muestra siempre con la plantilla nueva, sea cual sea la que
  // tenga el fotógrafo: es el diseño que se está mostrando en el video.
  const estilo = buildTemplateStyle("encontrate", fotografo.storefrontBrandColor);

  return (
    <div style={estilo}>
      <Demo
        dorsal={dorsalDemo}
        evento={evento.name}
        fotos={fotos}
        fotografo={{
          nombre: fotografo.name ?? "Fotógrafo",
          slug,
          avatar: avatarUrl,
          logo: logoUrl,
          iniciales,
        }}
        tienda={{
          photographer: {
            slug,
            name: fotografo.name ?? "Fotógrafo",
            bio: fotografo.bio,
            location: fotografo.location,
            instagramUrl: fotografo.instagramUrl,
            initials: iniciales,
            avatarUrl,
            logoUrl,
          },
          event: {
            id: evento.id,
            slug: evento.slug,
            name: evento.name,
            description: evento.description,
            discipline: evento.discipline,
            location: evento.location,
            eventDate: evento.eventDate?.toISOString() ?? null,
            coverUrl: null,
            pricePerPhoto: Number(evento.pricePerPhoto),
            currency: evento.currency,
            photosCount: fotos.length,
          },
          photos: fotos,
          discounts: [],
          buscaPorDorsal: evento.bibDetection,
        }}
      />
    </div>
  );
}
