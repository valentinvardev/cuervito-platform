import { notFound } from "next/navigation";

import { resolveAvatarUrl } from "~/server/avatar";
import { db } from "~/server/db";
import { getPresignedDownloadUrl } from "~/server/s3";
import { getMpTestMode } from "~/server/settings";

import { EventCoverageShell } from "./event-coverage-shell";

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
    },
  });
  if (!event) notFound();

  const coverSignedUrl = event.coverUrl
    ? event.coverUrl.startsWith("http")
      ? event.coverUrl
      : await getPresignedDownloadUrl(event.coverUrl, { expiresIn: 60 * 60 * 6 })
    : null;

  // Load all committed photos. We require `previewKey` to exist —
  // without it the falling back to `storageKey` would leak the original
  // un-watermarked image to the public storefront. The owner sees photos
  // in the dashboard immediately after upload; the public gallery only
  // catches up once the background watermark finishes (a few seconds
  // after the commit returns).
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
      storageKey: true,
      previewKey: true,
      bibNumbers: true,
      width: true,
      height: true,
    },
  });
  const photos = await Promise.all(
    rawPhotos.map(async (p) => ({
      id: p.id,
      previewUrl: await getPresignedDownloadUrl(p.previewKey ?? p.storageKey, {
        expiresIn: 60 * 30,
      }),
      bibNumbers: p.bibNumbers,
      width: p.width,
      height: p.height,
    })),
  );

  // Active discounts for nudge display and checkout
  const now = new Date();
  const discounts = await db.discount.findMany({
    where: {
      eventId: event.id,
      OR: [{ expires: null }, { expires: { gt: now } }],
    },
    select: {
      id: true, type: true, code: true, kind: true, value: true,
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

  const avatarUrl = await resolveAvatarUrl(photographer.image);
  const brandColor = photographer.storefrontBrandColor;
  const testMode = await getMpTestMode();

  return (
    <div
      style={
        brandColor
          ? ({
              "--accent": brandColor,
              // Derive hover/tint variables from the brand color so all
              // interactive states (button hovers, borders, backgrounds)
              // respect the photographer's custom palette instead of
              // falling back to the default orange.
              "--accent-bright": `color-mix(in srgb, ${brandColor} 85%, white)`,
              "--accent-deep":   `color-mix(in srgb, ${brandColor} 12%, transparent)`,
              "--border-accent": `color-mix(in srgb, ${brandColor} 40%, transparent)`,
            } as React.CSSProperties)
          : undefined
      }
    >
    <EventCoverageShell
      photographer={{
        slug,
        name: photographer.name ?? "Fotógrafo",
        bio: photographer.bio,
        location: photographer.location,
        instagramUrl: photographer.instagramUrl,
        initials,
        avatarUrl,
      }}
      event={{
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
      }}
      photos={photos}
      discounts={activeDiscounts}
      testMode={testMode}
    />
    </div>
  );
}
