import { db } from "~/server/db";
import { resolveMediaUrl } from "~/server/media";

// Static skeleton rendered by <Suspense> while PhotoStrip resolves. Occupies
// the same vertical footprint as the real strip so nothing jumps.
export function PhotoStripSkeleton() {
  return (
    <section className="photo-strip" aria-hidden>
      <div className="photo-strip-skel">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="skel" />
        ))}
      </div>
    </section>
  );
}

// Server component: fetches the most recent watermarked previews from published
// events, then hands them to the client marquee. The list is duplicated inside
// the client so the CSS keyframe can translate -50% for a seamless loop.
export async function PhotoStrip() {
  const photos = await db.photo.findMany({
    where: {
      deletedAt: null,
      previewKey: { not: null },
      event: { isPublished: true, status: { in: ["ACTIVE", "FINISHED"] } },
    },
    orderBy: { createdAt: "desc" },
    take: 24,
    select: {
      id: true,
      previewKey: true,
      event: { select: { name: true } },
    },
  });

  const tiles = await Promise.all(
    photos
      .filter((p): p is typeof p & { previewKey: string } => !!p.previewKey)
      .map(async (p) => ({
        id: p.id,
        eventName: p.event.name,
        url: await resolveMediaUrl(p.previewKey).catch(() => null),
      })),
  );

  const valid = tiles.filter((t): t is typeof t & { url: string } => !!t.url);
  if (valid.length === 0) return null;

  // Duplicate the row so the marquee loop is seamless. Keys are suffixed to
  // stay unique across the two copies.
  const doubled = [...valid, ...valid.map((t) => ({ ...t, id: `${t.id}-copy` }))];

  return (
    <section className="photo-strip" aria-label="Fotos de eventos recientes">
      <div className="photo-strip-track">
        {doubled.map((t) => (
          <div key={t.id} className="photo-strip-tile">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={t.url} alt="" loading="lazy" />
            <span className="tile-caption">{t.eventName}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
