import { NextResponse, type NextRequest } from "next/server";

import { accesoEvento, filtroFotosPropias } from "~/server/acceso-evento";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { getPresignedDownloadUrl } from "~/server/s3";

/**
 * Presigned download URL for a photo's original (no watermark). Used by the
 * dashboard lightbox so the photographer can download their own
 * full-resolution file without going through the public buyer flow.
 *
 * El dueño baja cualquiera; un colaborador, las que subió él. Un admin no:
 * modera el evento, no se lleva los originales de otro.
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
  const acceso = await accesoEvento(eventId, session.user);
  if (!acceso || acceso.rol === "admin") {
    return NextResponse.json({ error: "Foto no encontrada" }, { status: 404 });
  }

  const photo = await db.photo.findFirst({
    where: { id: photoId, eventId, deletedAt: null, ...filtroFotosPropias(acceso, session.user.id) },
    select: { storageKey: true, filename: true },
  });
  if (!photo) {
    return NextResponse.json({ error: "Foto no encontrada" }, { status: 404 });
  }

  const url = await getPresignedDownloadUrl(photo.storageKey, {
    expiresIn: 60 * 5,
    filename: photo.filename,
  });
  return NextResponse.json({ url, filename: photo.filename });
}
