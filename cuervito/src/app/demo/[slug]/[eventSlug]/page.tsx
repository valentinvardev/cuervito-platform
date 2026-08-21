import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { buildTemplateStyle } from "~/lib/storefront-templates";
import { resolveAvatarUrl } from "~/server/avatar";
import { db } from "~/server/db";
import { resolveMediaUrl } from "~/server/media";
import { getPresignedDownloadUrl } from "~/server/s3";

import { Demo } from "./_demo";

/**
 * La demo grabable de un evento real.
 *
 * Apunta a un evento publicado y usa SUS fotos: una demo con rectángulos grises
 * no sirve para mostrar un producto que vende fotos. Se abre en
 * /demo/<fotógrafo>/<evento> y se opera sola, de punta a punta, para poder
 * grabar la pantalla del teléfono.
 *
 * No pide sesión: no muestra nada que no esté ya público en la tienda del
 * fotógrafo. Sí lleva noindex, porque es una pantalla de trabajo y no algo que
 * tenga que aparecer en una búsqueda.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Demo",
};

export const dynamic = "force-dynamic";

const TOPE = 24;

export default async function DemoPage(props: {
  params: Promise<{ slug: string; eventSlug: string }>;
}) {
  const { slug, eventSlug } = await props.params;

  const fotografo = await db.user.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      bio: true,
      location: true,
      instagramUrl: true,
      image: true,
      logoKey: true,
      storefrontBrandColor: true,
      storefrontTemplate: true,
    },
  });
  if (!fotografo) notFound();

  const evento = await db.event.findFirst({
    where: { slug: eventSlug, ownerId: fotografo.id, isPublished: true },
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
    },
  });
  if (!evento) notFound();

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
      // Con marca de agua para la tienda; la entrega de la demo reusa la misma
      // lista, que es una diferencia con la entrega de verdad y no se nota en
      // el video.
      previewUrl: p.previewKey
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
