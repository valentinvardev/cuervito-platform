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
    select: {
      ownerId: true,
      eventId: true,
      storageKey: true,
      previewKey: true,
      _count: { select: { orderItems: true } },
    },
  });
  if (!photo || photo.ownerId !== session.user.id || photo.eventId !== eventId) {
    return NextResponse.json({ error: "Foto no encontrada" }, { status: 404 });
  }

  // Photos that have been sold can't be deleted — there are SaleItem rows
  // pointing at them and we want to keep the historical record intact.
  if (photo._count.orderItems > 0) {
    return NextResponse.json(
      {
        error:
          "No se puede eliminar — esta foto ya fue vendida. Contactanos si necesitás removerla.",
      },
      { status: 409 },
    );
  }

  const keys = [photo.storageKey, photo.previewKey].filter(Boolean) as string[];
  if (keys.length) {
    try {
      await deleteS3Objects(keys);
    } catch (err) {
      // S3 delete failing shouldn't block the DB delete — orphan keys
      // get reaped by the lambda cleanup job.
      console.warn("[photos delete] s3 delete failed:", err);
    }
  }

  try {
    await db.photo.delete({ where: { id: photoId } });
  } catch (err) {
    console.error("[photos delete] prisma delete failed:", err);
    return NextResponse.json(
      { error: "Error al borrar la foto." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
