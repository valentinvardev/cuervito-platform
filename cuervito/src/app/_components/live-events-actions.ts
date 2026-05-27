"use server";

import { db } from "~/server/db";
import { resolveMediaUrl } from "~/server/media";

export type LiveEvent = {
  href: string;
  name: string;
  date: string | null;
  location: string | null;
  photos: number;
  coverUrl: string | null;
};

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export async function searchLiveEvents(query: string): Promise<LiveEvent[]> {
  const q = normalize(query.trim());

  const events = await db.event.findMany({
    where: {
      isPublished: true,
      NOT: { status: "ARCHIVED" },
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { location: { contains: q, mode: "insensitive" } },
              { discipline: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }],
    take: 12,
    select: {
      slug: true,
      name: true,
      eventDate: true,
      location: true,
      coverUrl: true,
      owner: { select: { slug: true } },
      _count: { select: { photos: { where: { fileSize: { not: null } } } } },
      photos: {
        where: { previewKey: { not: null }, deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { previewKey: true },
      },
    },
  });

  const results = await Promise.all(
    events.map(async (e) => {
      const rawKey = e.coverUrl ?? e.photos[0]?.previewKey ?? null;
      let coverUrl: string | null = null;
      if (rawKey) {
        try {
          coverUrl = rawKey.startsWith("http")
            ? rawKey
            : await resolveMediaUrl(rawKey);
        } catch {
          coverUrl = null;
        }
      }
      return {
        href: e.owner.slug ? `/${e.owner.slug}/${e.slug}` : `#`,
        name: e.name,
        date: e.eventDate
          ? new Date(e.eventDate).toLocaleDateString("es-AR", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })
          : null,
        location: e.location,
        photos: e._count.photos,
        coverUrl,
      };
    }),
  );
  return results;
}
