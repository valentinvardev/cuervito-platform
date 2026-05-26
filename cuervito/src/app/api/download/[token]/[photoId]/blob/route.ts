import { type NextRequest } from "next/server";

import { db } from "~/server/db";
import { getS3ObjectBytes } from "~/server/s3";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Same-origin proxy for the original photo bytes — used by the iOS
 * Web Share flow on /descarga. The browser's fetch() of an S3 presigned
 * URL fails on iOS Safari because S3 doesn't return CORS headers, which
 * makes the blob → File → navigator.share() pipeline crash. By streaming
 * the bytes through our domain instead, the fetch stays same-origin and
 * iOS gets to show "Guardar imagen" → Photos.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ token: string; photoId: string }> },
) {
  const { token, photoId } = await ctx.params;

  const sale = await db.sale.findUnique({
    where: { downloadToken: token },
    select: {
      id: true,
      status: true,
      downloadTokenExpires: true,
      downloadCount: true,
      items: { select: { photoId: true } },
    },
  });

  if (!sale) return new Response("Token no encontrado", { status: 404 });
  if (sale.status !== "PAID") {
    return new Response("Compra no confirmada", { status: 403 });
  }
  if (sale.downloadTokenExpires && sale.downloadTokenExpires < new Date()) {
    return new Response("Link vencido", { status: 410 });
  }
  if (!sale.items.some((it) => it.photoId === photoId)) {
    return new Response("Foto no incluida en la compra", { status: 404 });
  }

  const photo = await db.photo.findUnique({
    where: { id: photoId },
    select: { storageKey: true, filename: true },
  });
  if (!photo) return new Response("Foto no encontrada", { status: 404 });

  let bytes: Uint8Array;
  try {
    bytes = await getS3ObjectBytes(photo.storageKey);
  } catch (err) {
    console.error("[download/blob] s3 fetch failed:", err);
    return new Response("No pudimos leer la foto", { status: 502 });
  }

  // Track download
  await db.sale
    .update({
      where: { id: sale.id },
      data: {
        downloadCount: { increment: 1 },
        ...(sale.downloadCount === 0 ? { firstDownloadAt: new Date() } : {}),
      },
    })
    .catch(() => undefined);

  await db.downloadLog
    .create({
      data: {
        saleId: sale.id,
        photoId,
        ip: req.headers.get("x-forwarded-for") ?? null,
        userAgent: req.headers.get("user-agent") ?? null,
      },
    })
    .catch(() => undefined);

  // Infer content-type from extension; default to jpeg.
  const ext = photo.filename.split(".").pop()?.toLowerCase() ?? "jpg";
  const contentType =
    ext === "png"
      ? "image/png"
      : ext === "webp"
        ? "image/webp"
        : "image/jpeg";

  // Copy into a fresh ArrayBuffer so TS' BodyInit type accepts it (the raw
  // Uint8Array from S3 has an ArrayBufferLike that's not narrowed).
  const ab = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(ab).set(bytes);
  // RFC 5987 encoding: ASCII fallback + UTF-8 encoded filename*
  const safeFilename = photo.filename.replace(/[^\x20-\x7E]/g, "_");
  const encodedFilename = encodeURIComponent(photo.filename);
  return new Response(new Blob([ab], { type: contentType }), {
    headers: {
      "content-type": contentType,
      "content-disposition": `inline; filename="${safeFilename}"; filename*=UTF-8''${encodedFilename}`,
      "cache-control": "private, no-store",
      "content-length": String(bytes.length),
    },
  });
}
