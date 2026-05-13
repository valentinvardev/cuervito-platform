"use server";

import { db } from "~/server/db";

export type LiveEvent = {
  href: string;
  name: string;
  date: string | null;
  location: string | null;
  photos: number;
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
      owner: { select: { slug: true } },
      _count: { select: { photos: { where: { fileSize: { not: null } } } } },
    },
  });

  return events.map((e) => ({
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
  }));
}
