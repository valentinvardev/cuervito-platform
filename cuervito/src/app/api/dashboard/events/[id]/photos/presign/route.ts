import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { env } from "~/env";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { puedeSubirAlEvento } from "~/server/acceso-evento";
import { alertar } from "~/server/alertas";
import { BASE } from "~/server/correos/diseno";
import { SinEspacio, assertStorageQuota, formatBytes, type QuotaUsage } from "~/server/quotas";
import { getPresignedUploadUrl, originalPhotoKey } from "~/server/s3";

/** Desde acá el equipo se entera de que una cuenta se está quedando sin lugar. */
const AVISAR_DESDE_PCT = 90;

/**
 * Avisa al equipo cuando una cuenta se queda sin espacio. Ampliarlo es a mano
 * (la tarjeta de cuotas en la ficha del usuario), así que si nadie se entera,
 * el fotógrafo descubre el límite en el medio de una subida, que es lo peor.
 * «poco» suena una vez por semana; «lleno» cada seis horas mientras siga.
 */
async function avisarEspacio(
  ownerId: string,
  eventId: string,
  s: QuotaUsage["storage"],
  cual: "poco" | "lleno",
) {
  const u = await db.user.findUnique({ where: { id: ownerId }, select: { name: true, email: true } });
  const quien = u?.name ?? u?.email ?? ownerId;
  const uso = `${formatBytes(s.usedBytes)} de ${formatBytes(s.limitBytes)} (${s.pct.toLocaleString("es-AR")} %)`;
  await alertar({
    clave: `espacio-${cual}:${ownerId}`,
    asunto:
      cual === "lleno"
        ? `${quien} se quedó sin espacio y no puede subir fotos`
        : `${quien} está por quedarse sin espacio`,
    lineas:
      cual === "lleno"
        ? [
            `Una subida acaba de rebotar por la cuota de almacenamiento: usa ${uso}.`,
            "Mientras no se amplíe, cada foto nueva que intente subir va a fallar.",
          ]
        : [
            `Usa ${uso}. Cuando llegue al límite, las subidas se cortan con un error.`,
            "Conviene ampliarle la cuota antes de su próximo evento.",
          ],
    detalle: `usuario ${ownerId}\nevento ${eventId}`,
    link: { texto: "Ampliar la cuota", url: `${BASE}/admin/users/${ownerId}` },
    cadaMin: cual === "lleno" ? 360 : 7 * 24 * 60,
  });
}

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const presignSchema = z.object({
  files: z
    .array(
      z.object({
        name: z.string().max(260),
        size: z.number().int().min(1),
        mimeType: z.string(),
      }),
    )
    .min(1)
    .max(50), // cap per request to avoid generating hundreds of URLs at once
});

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.status !== "ACTIVE") {
    return NextResponse.json({ error: "Cuenta inactiva" }, { status: 403 });
  }

  const { id: eventId } = await ctx.params;
  // Suben el dueño y los colaboradores que aceptaron la invitación.
  const access = await puedeSubirAlEvento(eventId, session.user);
  if (!access) {
    return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const parsed = presignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", issues: parsed.error.flatten() }, { status: 400 });
  }

  // Per-file validation
  const MAX_SIZE = env.QUOTA_MAX_PHOTO_BYTES;
  for (const f of parsed.data.files) {
    if (!ALLOWED_MIME.has(f.mimeType)) {
      return NextResponse.json(
        { error: `Tipo no permitido: ${f.mimeType}` },
        { status: 400 },
      );
    }
    if (f.size > MAX_SIZE) {
      return NextResponse.json(
        { error: `Archivo demasiado grande: ${f.name} (${(f.size / 1024 / 1024).toFixed(1)} MB · max ${(MAX_SIZE / 1024 / 1024).toFixed(0)} MB)` },
        { status: 400 },
      );
    }
  }

  // Quota: total bytes about to be uploaded
  const totalBytes = parsed.data.files.reduce((a, b) => a + b.size, 0);
  try {
    // El storage lo paga el dueño del evento aunque suba un colaborador.
    const q = await assertStorageQuota(access.ownerId, totalBytes);
    if (q.storage.pct >= AVISAR_DESDE_PCT) {
      void avisarEspacio(access.ownerId, eventId, q.storage, "poco").catch(() => undefined);
    }
  } catch (err) {
    // Antes cualquier error de acá salía como 413 «sin cuota», y el cliente
    // no reintenta un 4xx: una caída de la base cortaba la subida como si se
    // hubiera llenado la cuenta. Ahora eso es un 500, que sí se reintenta.
    if (!(err instanceof SinEspacio)) throw err;
    void avisarEspacio(access.ownerId, eventId, err.usado, "lleno").catch(() => undefined);
    const propio = access.ownerId === session.user.id;
    return NextResponse.json(
      {
        error: propio
          ? `Te quedaste sin espacio: usás ${formatBytes(err.usado.usedBytes)} de ${formatBytes(err.usado.limitBytes)}. Escribinos desde el chat y lo ampliamos.`
          : "La cuenta del dueño de este evento se quedó sin espacio. Avisale para que lo amplíe.",
      },
      { status: 413 },
    );
  }

  // Build all IDs + keys upfront so we can do both steps in parallel.
  const batch = parsed.data.files.map((f) => {
    const ext = EXT_BY_MIME[f.mimeType] ?? "jpg";
    const photoId = randomUUID();
    const key = originalPhotoKey(access.ownerId, eventId, photoId, ext);
    return { f, photoId, key };
  });

  // Presigned URL signing is local HMAC — run in parallel with the DB insert.
  const [uploadUrls] = await Promise.all([
    Promise.all(
      batch.map(({ f, key }) =>
        getPresignedUploadUrl({ key, contentType: f.mimeType, contentLength: f.size }),
      ),
    ),
    // Single round-trip instead of N concurrent db.photo.create calls.
    db.photo.createMany({
      data: batch.map(({ f, photoId, key }) => ({
        id: photoId,
        eventId,
        // ownerId = dueño del evento (cobra y paga storage).
        // uploadedById = quien realmente subió, para repartir comisiones
        // con scope OWN.
        ownerId: access.ownerId,
        uploadedById: session.user.id,
        storageKey: key,
        filename: f.name,
        mimeType: f.mimeType,
        // fileSize stays null until commit confirms the upload
      })),
    }),
  ]);

  const items = batch.map(({ f, photoId, key }, i) => ({
    photoId,
    filename: f.name,
    key,
    uploadUrl: uploadUrls[i]!.url,
    contentType: f.mimeType,
  }));

  return NextResponse.json({ items });
}
