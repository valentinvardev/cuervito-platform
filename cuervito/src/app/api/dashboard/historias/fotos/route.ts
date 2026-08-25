import { NextResponse, type NextRequest } from "next/server";

import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { puedeUsarHistorias } from "~/server/historias/acceso";
import { resolveMediaUrl } from "~/server/media";

/**
 * Las fotos de un evento, para elegir cuál va en la historia.
 *
 * Existe aparte del panel porque el estudio cambia de evento sin recargar: si
 * las fotos vinieran con la página, cambiar de evento costaría una navegación
 * entera y perder lo que uno ya había elegido de formato.
 *
 * Devuelve la vista previa SIN marca de agua, que es la que el dueño ya ve en
 * su panel: la historia se arma con esa, así que mostrar la marcada haría que
 * la miniatura y el resultado no coincidan.
 */

export const runtime = "nodejs";

// Un evento puede tener miles de fotos y esto es una grilla para elegir una,
// no un archivo para revisar. Las más nuevas primero, que son las del evento
// que el fotógrafo acaba de cubrir.
const TANDA = 60;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!(await puedeUsarHistorias(session?.user))) {
    return NextResponse.json({ error: "No disponible." }, { status: 403 });
  }

  const eventId = req.nextUrl.searchParams.get("eventId");
  if (!eventId) {
    return NextResponse.json({ error: "Falta el evento." }, { status: 400 });
  }

  const evento = await db.event.findFirst({
    where: { id: eventId, ownerId: session!.user.id },
    select: { id: true },
  });
  if (!evento) {
    return NextResponse.json({ error: "No encontramos ese evento." }, { status: 404 });
  }

  const fotos = await db.photo.findMany({
    where: { eventId, deletedAt: null, previewCleanKey: { not: null } },
    orderBy: { createdAt: "desc" },
    take: TANDA,
    select: { id: true, previewCleanKey: true },
  });

  return NextResponse.json({
    fotos: await Promise.all(
      fotos.map(async (f) => ({
        id: f.id,
        url: await resolveMediaUrl(f.previewCleanKey!),
      })),
    ),
  });
}
