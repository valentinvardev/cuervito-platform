import { NextResponse } from "next/server";

import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { generatePreview } from "~/server/watermark";

// Process in chunks so a single HTTP request doesn't hang for an hour on a
// 5000-photo system. The admin can call this endpoint repeatedly until
// remaining = 0.
const BATCH_SIZE = 25;

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Pick photos that have an original but a missing/stale preview
  const photos = await db.photo.findMany({
    where: {
      fileSize: { not: null },
      OR: [{ previewKey: null }, { previewGeneratedAt: null }],
    },
    orderBy: { createdAt: "asc" },
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

  const remaining = await db.photo.count({
    where: {
      fileSize: { not: null },
      OR: [{ previewKey: null }, { previewGeneratedAt: null }],
    },
  });

  return NextResponse.json({
    processed: photos.length,
    done,
    failed,
    remaining,
  });
}
