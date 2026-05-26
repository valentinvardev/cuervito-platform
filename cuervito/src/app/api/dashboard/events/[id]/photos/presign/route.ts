import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { env } from "~/env";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { assertStorageQuota } from "~/server/quotas";
import { getPresignedUploadUrl, originalPhotoKey } from "~/server/s3";

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
  const event = await db.event.findUnique({
    where: { id: eventId },
    select: { id: true, ownerId: true },
  });
  if (!event || event.ownerId !== session.user.id) {
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
    await assertStorageQuota(session.user.id, totalBytes);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sin cuota suficiente." },
      { status: 413 },
    );
  }

  // Build all IDs + keys upfront so we can do both steps in parallel.
  const batch = parsed.data.files.map((f) => {
    const ext = EXT_BY_MIME[f.mimeType] ?? "jpg";
    const photoId = randomUUID();
    const key = originalPhotoKey(session.user.id, eventId, photoId, ext);
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
        ownerId: session.user.id,
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
