import { NextResponse } from "next/server";

import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { resolveMediaUrl } from "~/server/media";
import { getPresignedDownloadUrl } from "~/server/s3";

/**
 * Lists the photos that were part of a sale, with display URLs. Seller-only.
 * Returns unwatermarked previews so the photographer can confirm which photos
 * the buyer received.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await ctx.params;

  const sale = await db.sale.findUnique({
    where: { id },
    select: {
      sellerId: true,
      items: {
        select: {
          photo: {
            select: {
              id: true,
              filename: true,
              storageKey: true,
              previewKey: true,
              previewCleanKey: true,
              bibNumbers: true,
            },
          },
        },
      },
    },
  });
  if (!sale) return NextResponse.json({ error: "Venta no encontrada" }, { status: 404 });
  if (sale.sellerId !== session.user.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const photos = await Promise.all(
    sale.items
      .map((it) => it.photo)
      .filter(<T,>(p: T): p is NonNullable<T> => p !== null)
      .map(async (p) => {
        const key = p.previewCleanKey ?? p.previewKey;
        return {
          id: p.id,
          filename: p.filename,
          bibNumbers: p.bibNumbers,
          previewUrl: key
            ? await resolveMediaUrl(key)
            : await getPresignedDownloadUrl(p.storageKey, { expiresIn: 60 * 30 }),
        };
      }),
  );

  return NextResponse.json({ photos });
}
