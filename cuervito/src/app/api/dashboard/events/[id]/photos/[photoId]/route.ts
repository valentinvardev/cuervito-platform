import { NextResponse, type NextRequest } from "next/server";

import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { deleteS3Objects } from "~/server/s3";

export async function DELETE(
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
    select: { ownerId: true, eventId: true, storageKey: true, previewKey: true },
  });
  if (!photo || photo.ownerId !== session.user.id || photo.eventId !== eventId) {
    return NextResponse.json({ error: "Foto no encontrada" }, { status: 404 });
  }

  const keys = [photo.storageKey, photo.previewKey].filter(Boolean) as string[];
  if (keys.length) await deleteS3Objects(keys);
  await db.photo.delete({ where: { id: photoId } });

  return NextResponse.json({ ok: true });
}
