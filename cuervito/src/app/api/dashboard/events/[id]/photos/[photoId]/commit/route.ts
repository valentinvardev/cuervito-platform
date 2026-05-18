import { NextResponse, type NextRequest } from "next/server";

import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { runFaceIndex, runOcr } from "~/server/rekognition";
import { deleteS3Objects, getObjectSize } from "~/server/s3";
import { generatePreview } from "~/server/watermark";

export async function POST(
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
      id: true,
      eventId: true,
      ownerId: true,
      storageKey: true,
      fileSize: true,
    },
  });
  if (!photo || photo.ownerId !== session.user.id || photo.eventId !== eventId) {
    return NextResponse.json({ error: "Foto no encontrada" }, { status: 404 });
  }
  if (photo.fileSize !== null) {
    return NextResponse.json({ ok: true, already: true });
  }

  // Verify the object actually landed in S3 with a HEAD request
  const size = await getObjectSize(photo.storageKey);
  if (size === null) {
    // Upload never completed — delete the stale Photo row so quota stays clean
    await db.photo.delete({ where: { id: photo.id } });
    return NextResponse.json({ error: "El archivo no llegó al storage" }, { status: 410 });
  }

  await db.photo.update({
    where: { id: photo.id },
    data: { fileSize: size },
  });

  // Everything below runs in the background — the client doesn't wait. The
  // public storefront filters by `previewGeneratedAt: { not: null }` so the
  // photo only appears once it has its watermark; the dashboard grid shows
  // it immediately with the original key as a fallback preview (the owner
  // is already authenticated, so seeing the unwatermarked original is fine).
  //
  // Order matters: generate the watermark FIRST so the preview is ready as
  // soon as possible. OCR + face index can take longer and aren't required
  // for the photo to be sellable.
  void (async () => {
    try {
      await generatePreview(photo.id);
    } catch (err) {
      console.error("[commit bg] generatePreview:", err);
    }
    void runOcr(photo.id).catch((err) => console.error("[commit bg] runOcr:", err));
    void runFaceIndex(photo.id, eventId).catch((err) =>
      console.error("[commit bg] runFaceIndex:", err),
    );
  })();

  return NextResponse.json({ ok: true, photoId: photo.id, size });
}

/* DELETE handler — used by the upload UI when the user cancels mid-upload */
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
