import { NextResponse, type NextRequest } from "next/server";

import { db } from "~/server/db";
import { getPresignedDownloadUrl } from "~/server/s3";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ token: string; photoId: string }> },
) {
  const { token, photoId } = await ctx.params;

  // Validate the token + that the photo belongs to that sale
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

  if (!sale) {
    return NextResponse.json({ error: "Token no encontrado" }, { status: 404 });
  }
  if (sale.status !== "PAID") {
    return NextResponse.json({ error: "Compra no confirmada" }, { status: 403 });
  }
  if (sale.downloadTokenExpires && sale.downloadTokenExpires < new Date()) {
    return NextResponse.json({ error: "El link de descarga venció" }, { status: 410 });
  }
  if (!sale.items.some((it) => it.photoId === photoId)) {
    return NextResponse.json({ error: "Foto no incluida en la compra" }, { status: 404 });
  }

  const photo = await db.photo.findUnique({
    where: { id: photoId },
    select: { storageKey: true, filename: true },
  });
  if (!photo) {
    return NextResponse.json({ error: "Foto no encontrada" }, { status: 404 });
  }

  // Generate a short-lived presigned GET for the original (no watermark).
  const url = await getPresignedDownloadUrl(photo.storageKey, {
    expiresIn: 60 * 5,
    filename: photo.filename,
  });

  // Track first download + bump count
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

  return NextResponse.json({ url, filename: photo.filename });
}
