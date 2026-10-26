import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { accesoEvento, filtroFotosPropias } from "~/server/acceso-evento";
import { auth } from "~/server/auth";
import { db } from "~/server/db";

const bodySchema = z.object({
  photoIds: z.array(z.string().min(1)).min(1).max(500),
});

/**
 * Soft-delete many photos at once. Marks each Photo.deletedAt = now() so the
 * storefront stops listing them. Buyers who already purchased can still
 * download them — the daily cron (/api/cron/cleanup) hard-deletes anything
 * older than PHOTO_RETENTION_DAYS.
 *
 * Quién puede: el dueño y un admin moderando, cualquier foto del evento; un
 * colaborador, sólo las que subió él. Antes el filtro era `ownerId`, que en
 * Photo es siempre el dueño del evento: el colaborador borraba cero fotos sin
 * ningún error, y el comentario de arriba decía lo contrario de lo que hacía.
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

  const acceso = await accesoEvento(eventId, session.user);
  if (!acceso) {
    return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
  }

  const result = await db.photo.updateMany({
    where: {
      id: { in: parsed.data.photoIds },
      eventId,
      ...filtroFotosPropias(acceso, session.user.id),
      deletedAt: null,
    },
    data: { deletedAt: new Date() },
  });

  return NextResponse.json({ deleted: result.count });
}
