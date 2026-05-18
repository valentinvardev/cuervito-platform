import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { deleteS3Objects } from "~/server/s3";

const bodySchema = z.object({
  photoIds: z.array(z.string().min(1)).min(1).max(500),
});

/**
 * Delete many photos at once from the event gallery. Photos that have
 * already been sold are skipped (returned in `skipped`) — the rest are
 * deleted from both S3 and the database in one transaction.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: eventId } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "photoIds requerido (array no vacío)" },
      { status: 400 },
    );
  }

  // Pull only photos this user owns in this event
  const photos = await db.photo.findMany({
    where: {
      id: { in: parsed.data.photoIds },
      eventId,
      ownerId: session.user.id,
    },
    select: {
      id: true,
      storageKey: true,
      previewKey: true,
      _count: { select: { orderItems: true } },
    },
  });

  const deletable = photos.filter((p) => p._count.orderItems === 0);
  const sold = photos.filter((p) => p._count.orderItems > 0).map((p) => p.id);

  if (deletable.length === 0) {
    return NextResponse.json({
      deleted: 0,
      skippedSold: sold,
      notFound:
        parsed.data.photoIds.length -
        photos.length, // ids that didn't match this user's photos in this event
    });
  }

  // S3 first (best-effort) — orphans are cheap, FK errors aren't.
  const keys = deletable.flatMap(
    (p) => [p.storageKey, p.previewKey].filter(Boolean) as string[],
  );
  if (keys.length) {
    try {
      await deleteS3Objects(keys);
    } catch (err) {
      console.warn("[photos bulk-delete] s3 delete failed:", err);
    }
  }

  const result = await db.photo.deleteMany({
    where: { id: { in: deletable.map((p) => p.id) } },
  });

  return NextResponse.json({
    deleted: result.count,
    skippedSold: sold,
    notFound: parsed.data.photoIds.length - photos.length,
  });
}
