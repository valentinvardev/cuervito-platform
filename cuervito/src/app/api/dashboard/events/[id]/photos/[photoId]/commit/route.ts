import { NextResponse, type NextRequest } from "next/server";

import { auth } from "~/server/auth";
import { despertar } from "~/server/cola-fotos";
import { db } from "~/server/db";
import { canUploadToEvent } from "~/server/event-access";
import { deleteS3Objects, headObject } from "~/server/s3";

/**
 * Confirmar que la foto llegó a S3. Nada más.
 *
 * Acá adentro corría todo el procesamiento —marca de agua, miniatura, OCR,
 * caras— en un `void (async () => …)()` que se lanzaba sin esperar. Eso es lo
 * que dejó 160 fotos cobrables e invisibles la noche que hubo tres deploys
 * seguidos: la promesa vivía en la memoria del proceso y el proceso se
 * reinició.
 *
 * Ahora esta ruta hace dos cosas: anota que el archivo está, y toca el timbre.
 * El trabajo lo saca de la base ~/server/cola-fotos, que es lo único que
 * sobrevive a un `pm2 restart`. Si el timbre no llega a sonar, no se pierde
 * nada: la foto ya quedó anotada como pendiente.
 */

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
      previewKey: true,
    },
  });
  // El commit lo hace quien subió: puede ser el dueño o un colaborador,
  // así que se valida contra el acceso al evento y no contra photo.ownerId
  // (que siempre apunta al dueño).
  const access = await canUploadToEvent(eventId, session.user.id);
  if (!photo || !access || photo.eventId !== eventId) {
    return NextResponse.json({ error: "Foto no encontrada" }, { status: 404 });
  }

  if (photo.fileSize !== null) {
    /* Ya tenía tamaño, pero puede no tener marca de agua.

       No es teórico: la Lambda de S3 escribe fileSize apenas ve el objeto y
       vuelve sin procesar si el dueño pasó el tope de gasto. El commit llega
       después, ve el tamaño puesto, contesta "ya estaba" y —hasta ahora— nadie
       generaba nunca el preview. Es una de las dos causas plausibles de las
       160 fotos invisibles. Tocar el timbre acá no cuesta nada. */
    if (!photo.previewKey) despertar();
    return NextResponse.json({ ok: true, already: true });
  }

  /* Las TRES respuestas de S3, no dos.

     Antes esto era `getObjectSize`, que devolvía null tanto si el objeto no
     estaba como si S3 no pudo contestar, y en los dos casos se BORRABA la fila.
     Con S3 teniendo un mal momento, eso borra fotos que sí llegaron —y deja el
     objeto huérfano pagando storage sin ninguna fila que lo referencie—. */
  const h = await headObject(photo.storageKey);

  if (h.estado === "error") {
    // El cliente ya trata el 5xx como transitorio y reintenta.
    return NextResponse.json(
      { error: "No pudimos verificar el archivo. Probá de nuevo." },
      { status: 503 },
    );
  }
  if (h.estado === "no-existe") {
    /* No se borra la fila acá.

       Puede que el PUT esté todavía en vuelo y el commit haya llegado antes por
       un reintento del cliente. La barrida de huérfanas decide con calma: si a
       las 24 horas el objeto sigue sin estar, ahí sí se borra. */
    return NextResponse.json({ error: "El archivo no llegó al storage" }, { status: 410 });
  }

  // CAS: si la Lambda ya escribió el tamaño, no lo pisamos.
  await db.photo.updateMany({
    where: { id: photo.id, fileSize: null },
    data: { fileSize: h.size },
  });

  // El timbre. Si no suena, la próxima pasada la levanta igual.
  despertar();

  return NextResponse.json({ ok: true, photoId: photo.id, size: h.size });
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
    select: {
      ownerId: true,
      eventId: true,
      storageKey: true,
      previewKey: true,
      previewCleanKey: true,
      // La miniatura también, o queda huérfana en el bucket para siempre.
      thumbKey: true,
    },
  });
  if (!photo || photo.ownerId !== session.user.id || photo.eventId !== eventId) {
    return NextResponse.json({ error: "Foto no encontrada" }, { status: 404 });
  }
  const keys = [
    photo.storageKey,
    photo.previewKey,
    photo.previewCleanKey,
    photo.thumbKey,
  ].filter(Boolean) as string[];
  if (keys.length) await deleteS3Objects(keys);
  await db.photo.delete({ where: { id: photoId } });
  return NextResponse.json({ ok: true });
}
