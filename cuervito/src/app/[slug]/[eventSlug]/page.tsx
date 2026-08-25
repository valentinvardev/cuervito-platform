import { notFound } from "next/navigation";

import { buildTemplateStyle, getTemplate } from "~/lib/storefront-templates";
import { resolveAvatarUrl } from "~/server/avatar";
import { db } from "~/server/db";
import { getPresignedDownloadUrl } from "~/server/s3";
import { ahora, lento } from "~/server/medir";
import { resolveMediaUrl } from "~/server/media";
import { getMpTestMode } from "~/server/settings";

import { EventCoverageShell } from "./event-coverage-shell";
import { EncontrateShell } from "./encontrate/shell";
import { EventFeedShell } from "./event-feed-shell";

const RESERVED = new Set([
  "dashboard", "admin", "login", "signup", "onboarding", "suspended",
  "api", "descarga", "_components", "_next", "favicon.ico", "robots.txt",
]);

export default async function PublicEventPage(props: {
  params: Promise<{ slug: string; eventSlug: string }>;
}) {
  const { slug, eventSlug } = await props.params;
  if (RESERVED.has(slug)) notFound();

  const photographer = await db.user.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      bio: true,
      location: true,
      instagramUrl: true,
      image: true,
      storefrontBrandColor: true,
      storefrontTemplate: true,
      logoKey: true,
      status: true,
      onboardingCompletedAt: true,
    },
  });
  if (!photographer || photographer.status !== "ACTIVE" || !photographer.onboardingCompletedAt) {
    notFound();
  }

  const event = await db.event.findFirst({
    where: {
      slug: eventSlug,
      ownerId: photographer.id,
      isPublished: true,
      NOT: { status: "ARCHIVED" },
    },
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
      // Si el evento no lee dorsales, la tienda no ofrece buscar por dorsal:
      // mandar a escribir un número que no va a encontrar nada es peor que no
      // ofrecerlo.
      bibDetection: true,
    },
  });
  if (!event) notFound();

  const coverSignedUrl = event.coverUrl
    ? event.coverUrl.startsWith("http")
      ? event.coverUrl
      : await resolveMediaUrl(event.coverUrl)
    : null;

  // Load all committed photos. We require `previewKey` to exist —
  // without it the falling back to `storageKey` would leak the original
  // un-watermarked image to the public storefront. The owner sees photos
  // in the dashboard immediately after upload; the public gallery only
  // catches up once the background watermark finishes (a few seconds
  // after the commit returns).
  const tFotos = ahora();
  const rawPhotos = await db.photo.findMany({
    where: {
      eventId: event.id,
      fileSize: { not: null },
      deletedAt: null,
      previewKey: { not: null },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      // storageKey NO: es el original sin marca de agua y no se usa en
      // esta pantalla. Traerlo son 136 bytes por foto —300 KB en este
      // evento— cruzando la red para descartarse.
      previewKey: true,
      bibNumbers: true,
      width: true,
      height: true,
    },
  });
  lento("evento · traer fotos", tFotos);

  const tUrls = ahora();
  const photos = await Promise.all(
    rawPhotos.map(async (p) => ({
      id: p.id,
      previewUrl: await resolveMediaUrl(p.previewKey!),
      bibNumbers: p.bibNumbers,
      width: p.width,
      height: p.height,
    })),
  );
  lento(`evento · resolver ${photos.length} urls`, tUrls);

  // Active discounts for nudge display and checkout
  const now = new Date();
  const discounts = await db.discount.findMany({
    where: {
      eventId: event.id,
      OR: [{ expires: null }, { expires: { gt: now } }],
    },
    select: {
      // SIN `code`: esto viaja al navegador. Con el código adentro, todos los
      // cupones del evento quedaban en el HTML de la página de venta y los
      // leía cualquiera con las herramientas de desarrollo, que es
      // exactamente lo contrario de para qué existe un código.
      id: true, type: true, kind: true, value: true,
      qty: true, price: true, expires: true, maxUses: true, usageCount: true,
    },
  });
  const activeDiscounts = discounts
    .filter((d) => d.maxUses === null || d.usageCount < d.maxUses)
    .map((d) => ({
      ...d,
      value: d.value ? Number(d.value) : null,
      price: d.price ? Number(d.price) : null,
      expires: d.expires?.toISOString() ?? null,
    }));

  const initials =
    photographer.name
      ?.split(" ")
      .map((p) => p[0]?.toUpperCase() ?? "")
      .filter(Boolean)
      .slice(0, 2)
      .join("") || "?";

  const [avatarUrl, logoUrl, testMode] = await Promise.all([
    resolveAvatarUrl(photographer.image),
    photographer.logoKey
      ? resolveMediaUrl(photographer.logoKey)
      : null,
    getMpTestMode(),
  ]);

  const pageStyle = {
    ...buildTemplateStyle(photographer.storefrontTemplate, photographer.storefrontBrandColor),
    // Derive accent hover/tint variables from brand color
    ...(photographer.storefrontBrandColor
      ? {
          "--accent-bright": `color-mix(in srgb, ${photographer.storefrontBrandColor} 85%, white)`,
          "--accent-deep":   `color-mix(in srgb, ${photographer.storefrontBrandColor} 12%, transparent)`,
          "--border-accent": `color-mix(in srgb, ${photographer.storefrontBrandColor} 40%, transparent)`,
        }
      : {}),
  } as React.CSSProperties;

  const shellProps = {
    photographer: {
      slug,
      name: photographer.name ?? "Fotógrafo",
      bio: photographer.bio,
      location: photographer.location,
      instagramUrl: photographer.instagramUrl,
      initials,
      avatarUrl,
      logoUrl,
    },
    event: {
      id: event.id,
      slug: event.slug,
      name: event.name,
      description: event.description,
      discipline: event.discipline,
      location: event.location,
      eventDate: event.eventDate?.toISOString() ?? null,
      coverUrl: coverSignedUrl,
      pricePerPhoto: Number(event.pricePerPhoto),
      currency: event.currency,
      photosCount: photos.length,
    },
    photos,
    discounts: activeDiscounts,
    testMode,
  };

  const layout = getTemplate(photographer.storefrontTemplate).layout;

  return (
    <div style={pageStyle}>
      {layout === "encontrate" ? (
        <EncontrateShell {...shellProps} buscaPorDorsal={event.bibDetection} />
      ) : layout === "feed" ? (
        <EventFeedShell {...shellProps} />
      ) : (
        <EventCoverageShell {...shellProps} />
      )}
    </div>
  );
}
