import { NextResponse } from "next/server";

import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { generatePreview } from "~/server/watermark";

const BATCH_SIZE = 25;

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const photos = await db.photo.findMany({
    where: {
      ownerId: session.user.id,
      fileSize: { not: null },
      deletedAt: null,
    },
    orderBy: { createdAt: "asc" },
    take: BATCH_SIZE,
    select: { id: true },
  });

  let done = 0;
  let failed = 0;
  for (const p of photos) {
    const ok = await generatePreview(p.id);
    if (ok) done++;
    else failed++;
  }

  const remaining = await db.photo.count({
    where: {
      ownerId: session.user.id,
      fileSize: { not: null },
      deletedAt: null,
    },
  });

  return NextResponse.json({ processed: photos.length, done, failed, remaining });
}
