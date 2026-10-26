import { NextResponse, type NextRequest } from "next/server";

import { accesoEvento, filtroFotosPropias } from "~/server/acceso-evento";
import { auth } from "~/server/auth";
import { db } from "~/server/db";

/**
 * Soft-delete a single photo. The row stays in the DB (and the file stays
 * in S3) so anyone who already bought it can still download from their
 * /descarga/{token} page. The daily /api/cron/cleanup job removes
 * photos whose `deletedAt` is older than PHOTO_RETENTION_DAYS.
 *
 * Quién puede: el dueño y un admin, cualquier foto del evento; un
 * colaborador, sólo las que subió él (ver acceso-evento.ts).
 */
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; photoId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: eventId, photoId } = await ctx.params;
  const acceso = await accesoEvento(eventId, session.user);
  if (!acceso) {
    return NextResponse.json({ error: "Foto no encontrada" }, { status: 404 });
  }

  const photo = await db.photo.findFirst({
    where: { id: photoId, eventId, ...filtroFotosPropias(acceso, session.user.id) },
    select: { deletedAt: true },
  });
  if (!photo) {
    return NextResponse.json({ error: "Foto no encontrada" }, { status: 404 });
  }

  // Idempotent: if already soft-deleted, no-op.
  if (!photo.deletedAt) {
    try {
      await db.photo.update({
        where: { id: photoId },
        data: { deletedAt: new Date() },
      });
    } catch (err) {
      console.error("[photos delete] soft-delete failed:", err);
      return NextResponse.json(
        { error: "Error al eliminar la foto." },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ ok: true });
}
