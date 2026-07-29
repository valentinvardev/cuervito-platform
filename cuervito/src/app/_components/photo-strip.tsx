import { db } from "~/server/db";
import { resolveMediaUrl } from "~/server/media";

// Static skeleton rendered by <Suspense> while PhotoStrip resolves. Occupies
// the same vertical footprint as the real strip so nothing jumps.
export function PhotoStripSkeleton() {
  return (
    <section className="photo-strip" aria-hidden>
      <div className="lp-skel-area">
        {[0, 1].map((row) => (
          <div key={row} className="photo-strip-skel">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="skel" />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

// Server component: fetches the most recent watermarked previews from published
// events, then hands them to the client marquee. The list is duplicated inside
// the client so the CSS keyframe can translate -50% for a seamless loop.
export async function PhotoStrip() {
  // Solo portadas de evento — no llevan watermark, así que quedan limpias
  // en el hero. Un cover por evento publicado; ordenamos por eventDate
  // para priorizar lo más reciente.
  const events = await db.event.findMany({
    where: {
      isPublished: true,
      status: { in: ["ACTIVE", "FINISHED"] },
      coverUrl: { not: null },
    },
    orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }],
    take: 48,
    select: {
      id: true,
      coverUrl: true,
    },
  });

  const tiles = await Promise.all(
    events
      .filter((e): e is typeof e & { coverUrl: string } => !!e.coverUrl)
      .map(async (e) => ({
        id: e.id,
        url: await resolveMediaUrl(e.coverUrl).catch(() => null),
      })),
  );

  const valid = tiles.filter((t): t is typeof t & { url: string } => !!t.url);
  if (valid.length === 0) return null;

  // Split into two rows for a richer mosaic. Odd-indexed items land in the
  // top row (scrolls left), even-indexed in the bottom row (scrolls right).
  // Fallback: if only one row's worth of photos, repeat the same set for the
  // second row so the layout still feels full.
  const rowA = valid.filter((_, i) => i % 2 === 0);
  const rowB = valid.filter((_, i) => i % 2 === 1);
  const useB = rowB.length >= 6 ? rowB : rowA;

  const dup = <T extends { id: string }>(arr: T[]) => [
    ...arr,
    ...arr.map((t) => ({ ...t, id: `${t.id}-copy` })),
  ];

  return (
    <section className="photo-strip" aria-label="Fotos de eventos recientes">
      <div className="photo-strip-row">
        <div className="photo-strip-track">
          {dup(rowA).map((t) => (
            <div key={t.id} className="photo-strip-tile">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={t.url} alt="" loading="lazy" />
            </div>
          ))}
        </div>
      </div>
      <div className="photo-strip-row">
        <div className="photo-strip-track photo-strip-track-reverse">
          {dup(useB).map((t) => (
            <div key={t.id} className="photo-strip-tile">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={t.url} alt="" loading="lazy" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
