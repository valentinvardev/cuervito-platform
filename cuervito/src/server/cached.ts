import "server-only";

import { unstable_cache } from "next/cache";

import { db } from "~/server/db";
import { getQuotaUsage } from "~/server/quotas";

/**
 * Cached counts for the dashboard root.
 *
 * These tolerate ~30s of staleness — when a fotógrafo uploads photos or
 * receives a sale, the right counter is allowed to lag a bit. The win is
 * skipping ~600ms of pooler round-trips on every nav back to /dashboard.
 *
 * Cache keyed by userId so each photographer gets their own bucket.
 * Tag-based invalidation lets us bust it explicitly when needed
 * (e.g. after creating an event).
 */
export const getDashboardCounts = (userId: string) =>
  unstable_cache(
    async () => {
      const [eventCounts, salesCount] = await Promise.all([
        db.event.groupBy({
          where: { ownerId: userId },
          by: ["status"],
          _count: { _all: true },
        }),
        db.sale.count({ where: { sellerId: userId, status: "PAID" } }),
      ]);
      const eventsByStatus = Object.fromEntries(
        eventCounts.map((c) => [c.status, c._count._all]),
      ) as Record<string, number>;
      return {
        activeEvents:
          (eventsByStatus.ACTIVE ?? 0) + (eventsByStatus.PROCESSING ?? 0),
        finishedEvents:
          (eventsByStatus.FINISHED ?? 0) + (eventsByStatus.ARCHIVED ?? 0),
        salesCount,
      };
    },
    ["dashboard-counts", userId],
    { revalidate: 30, tags: [`user:${userId}:dashboard`] },
  )();

/**
 * Quota usage — storage + recognitions. These change slowly (uploads bump
 * storage on commit; recognition count updates after OCR/face). 30s of
 * staleness is fine for a dashboard widget.
 */
export const getCachedQuotaUsage = (userId: string) =>
  unstable_cache(
    () => getQuotaUsage(userId),
    ["quota-usage", userId],
    { revalidate: 30, tags: [`user:${userId}:quota`] },
  )();

/**
 * Photographer's events list — used in /dashboard/events. Cached 60s so
 * navigating away and back is instant. Mutations (create, edit, delete)
 * should call revalidateTag(`user:${userId}:events`) to bust it.
 */
export const getCachedEventsList = (userId: string) =>
  unstable_cache(
    async () => {
      const events = await db.event.findMany({
        where: { ownerId: userId, NOT: { status: "ARCHIVED" } },
        orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          slug: true,
          name: true,
          eventDate: true,
          location: true,
          discipline: true,
          status: true,
          _count: { select: { photos: true, sales: true } },
        },
      });
      // Serialize Date → ISO string here so the cache stores a plain object.
      return events.map((e) => ({
        id: e.id,
        slug: e.slug,
        name: e.name,
        eventDate: e.eventDate?.toISOString() ?? null,
        location: e.location,
        discipline: e.discipline,
        status: e.status,
        photos: e._count.photos,
        sales: e._count.sales,
      }));
    },
    ["events-list", userId],
    { revalidate: 60, tags: [`user:${userId}:events`] },
  )();
