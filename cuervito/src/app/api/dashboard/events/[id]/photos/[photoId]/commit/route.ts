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

  // Generate the watermarked preview synchronously so the grid tile lights up
  // with the real preview right after the upload finishes.
  const previewKey = await generatePreview(photo.id);

  // Fire-and-forget OCR + face index in the background (same pattern as SINCHI).
  // These can take 1–3s each, so we don't make the user wait.
  void runOcr(photo.id).catch((err) => console.error("[commit] runOcr:", err));
  void runFaceIndex(photo.id, eventId).catch((err) =>
    console.error("[commit] runFaceIndex:", err),
  );

  return NextResponse.json({ ok: true, photoId: photo.id, size, previewKey });
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
