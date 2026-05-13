import { type NextRequest } from "next/server";
// archiver v7 ESM exports `ZipArchive` at runtime but @types/archiver targets
// the older CJS shape. We bridge by typing it through the `Archiver` base.
import type { Archiver } from "archiver";
import * as archiverNs from "archiver";
const ZipArchive = (archiverNs as unknown as {
  ZipArchive: new (opts?: { zlib?: { level?: number } }) => Archiver;
}).ZipArchive;
import { Readable } from "node:stream";

import { db } from "~/server/db";
import { getS3ObjectBytes } from "~/server/s3";

export const runtime = "nodejs";
// Generous max so we can stream large zips.
export const maxDuration = 300;

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;

  const sale = await db.sale.findUnique({
    where: { downloadToken: token },
    select: {
      id: true,
      status: true,
      downloadTokenExpires: true,
      downloadCount: true,
      event: { select: { name: true, slug: true } },
      items: {
        select: {
          photoId: true,
          photo: { select: { id: true, storageKey: true, filename: true } },
        },
      },
    },
  });
  if (!sale) return new Response("Token no encontrado", { status: 404 });
  if (sale.status !== "PAID") return new Response("Compra no confirmada", { status: 403 });
  if (sale.downloadTokenExpires && sale.downloadTokenExpires < new Date()) {
    return new Response("El link de descarga venció", { status: 410 });
  }

  const archive = new ZipArchive({ zlib: { level: 0 } }); // photos are JPG already, no recompression
  archive.on("error", (err: Error) => console.error("[zip] archiver error:", err));

  // Stream files in sequence (parallel reads can balloon memory)
  void (async () => {
    for (const it of sale.items) {
      if (!it.photo) continue;
      try {
        const bytes = await getS3ObjectBytes(it.photo.storageKey);
        archive.append(Buffer.from(bytes), { name: it.photo.filename });
      } catch (err) {
        console.error("[zip] failed to fetch", it.photo.storageKey, err);
      }
    }
    await archive.finalize();
  })();

  // Track download
  void db.sale
    .update({
      where: { id: sale.id },
      data: {
        downloadCount: { increment: 1 },
        ...(sale.downloadCount === 0 ? { firstDownloadAt: new Date() } : {}),
      },
    })
    .catch(() => undefined);
  void db.downloadLog
    .create({
      data: {
        saleId: sale.id,
        ip: req.headers.get("x-forwarded-for") ?? null,
        userAgent: req.headers.get("user-agent") ?? null,
      },
    })
    .catch(() => undefined);

  const zipName = `${(sale.event.slug || "cuervito").slice(0, 40)}-fotos.zip`;
  return new Response(Readable.toWeb(archive) as unknown as ReadableStream, {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${zipName}"`,
      "cache-control": "no-store",
    },
  });
}
