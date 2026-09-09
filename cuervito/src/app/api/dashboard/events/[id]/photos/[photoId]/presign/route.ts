import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { env } from "~/env";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { canUploadToEvent } from "~/server/event-access";
import { getPresignedUploadUrl, PRESIGN_SUBIDA_TTL_S } from "~/server/s3";

/**
 * Una URL de subida nueva para una foto que YA tiene su fila.
 *
 * Existe porque una URL firmada vence, y ése era el techo real de las subidas
 * grandes. El navegador firmaba las 2.000 fotos de una y los obreros las
 * consumían en orden: al llegar a una firmada hacía más de quince minutos, S3
 * contestaba 403, el cliente lo trataba como fatal y todo lo que quedaba en la
 * cola moría en ráfaga. Medido en producción con fotos de 14,9 MB a 3,9 MB/s:
 * entraban unas 235. La fotógrafa había aprendido a subir de a 220 sin saber
 * por qué.
 *
 * La diferencia con /photos/presign —la que firma de a cincuenta— es que ésta
 * NO crea nada: misma fila, misma storageKey, mismo objeto de destino. Es
 * literalmente "dame otra autorización para lo mismo". Por eso tampoco pide
 * cuota de storage: no hay bytes nuevos, son los mismos que ya se contaron al
 * firmar la primera vez.
 *
 * Que no cree filas es el punto entero. La alternativa —que el cliente vuelva a
 * pasar por el presign normal cuando le vence una firma— crea una fila y un
 * objeto NUEVOS por cada reintento, y es una de las dos fuentes de las 1.658
 * filas sin fileSize que quedaron en la base.
 */

export const runtime = "nodejs";

const cuerpo = z.object({
  /** El tamaño va en la firma, así que tiene que coincidir con el PUT. */
  size: z.number().int().min(1),
});

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; photoId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.status !== "ACTIVE") {
    return NextResponse.json({ error: "Cuenta inactiva" }, { status: 403 });
  }

  const { id: eventId, photoId } = await ctx.params;
  const acceso = await canUploadToEvent(eventId, session.user.id);
  if (!acceso) {
    return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
  }

  const parsed = cuerpo.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  const { size } = parsed.data;

  const foto = await db.photo.findUnique({
    where: { id: photoId },
    select: {
      eventId: true,
      storageKey: true,
      mimeType: true,
      fileSize: true,
      deletedAt: true,
    },
  });
  if (!foto || foto.eventId !== eventId || foto.deletedAt) {
    return NextResponse.json({ error: "Foto no encontrada" }, { status: 404 });
  }

  /* Ya está subida: se avisa, no se rechaza.
   *
   * Pasa cuando el PUT llegó a S3 y lo que falló fue el commit, o cuando el
   * commit corrió dos veces. Devolver 404 acá haría que el cliente cayera al
   * presign normal y creara fila y objeto nuevos para un archivo que ya está
   * arriba: la misma foto dos veces en un evento con ventas. */
  if (foto.fileSize !== null) {
    return NextResponse.json({ already: true });
  }

  if (size > env.QUOTA_MAX_PHOTO_BYTES) {
    return NextResponse.json({ error: "Archivo demasiado grande" }, { status: 400 });
  }

  const { url } = await getPresignedUploadUrl({
    key: foto.storageKey,
    contentType: foto.mimeType ?? "image/jpeg",
    contentLength: size,
  });

  return NextResponse.json({
    uploadUrl: url,
    contentType: foto.mimeType ?? "image/jpeg",
    validaMs: PRESIGN_SUBIDA_TTL_S * 1000,
  });
}
