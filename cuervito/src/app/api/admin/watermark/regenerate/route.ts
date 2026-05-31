import { NextResponse, type NextRequest } from "next/server";

import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { generatePreview } from "~/server/watermark";

const BATCH_SIZE = 25;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as {
    userId?: string;
    force?: boolean;
  };
  // Optional: scope to a single user's photos (for per-user watermark regeneration)
  const ownerId = body.userId;
  // `force: true` regenerates every matching photo (e.g. after changing the
  // platform watermark). Default mode only processes photos missing one of the
  // previews — used for backfilling new fields without burning CPU on photos
  // that are already up to date.
  const force = !!body.force;

  const baseWhere = {
    fileSize: { not: null } as { not: null },
    deletedAt: null as null,
    ...(ownerId ? { ownerId } : {}),
    ...(force
      ? {}
      : {
          OR: [
            { previewKey: null },
            { previewCleanKey: null },
            { previewGeneratedAt: null },
          ],
        }),
  };

  const photos = await db.photo.findMany({
    where: baseWhere,
    orderBy: { createdAt: "asc" as const },
    take: BATCH_SIZE,
    select: { id: true },
  });

  let done = 0;
  let failed = 0;
  for (const p of photos) {
    const r = await generatePreview(p.id);
    if (r) done++;
    else failed++;
  }

  const remaining = await db.photo.count({ where: baseWhere });

  return NextResponse.json({ processed: photos.length, done, failed, remaining });
}
