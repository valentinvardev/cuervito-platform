import { NextResponse, type NextRequest } from "next/server";

import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { getPresignedDownloadUrl } from "~/server/s3";

/**
 * Owner-only presigned download URL for a photo's original (no watermark).
 * Used by the dashboard lightbox so the photographer can download their own
 * full-resolution file without going through the public buyer flow.
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; photoId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: eventId, photoId } = await ctx.params;
  const photo = await db.photo.findUnique({
    where: { id: photoId },
    select: {
      ownerId: true,
      eventId: true,
      storageKey: true,
      filename: true,
      deletedAt: true,
    },
  });
  if (
    !photo ||
    photo.ownerId !== session.user.id ||
    photo.eventId !== eventId ||
    photo.deletedAt
  ) {
    return NextResponse.json({ error: "Foto no encontrada" }, { status: 404 });
  }

  const url = await getPresignedDownloadUrl(photo.storageKey, {
    expiresIn: 60 * 5,
    filename: photo.filename,
  });
  return NextResponse.json({ url, filename: photo.filename });
}
