import { NextResponse } from "next/server";

import { db } from "~/server/db";

/**
 * Lightweight status poll for /pago/procesando.
 *
 * Returns just enough info to drive the UI: the sale status and (if PAID)
 * the downloadToken so the client can redirect to /descarga/[token].
 * No auth: the saleId is opaque (cuid) and the response leaks nothing
 * beyond what the buyer already knows (they're the ones polling).
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const sale = await db.sale.findUnique({
    where: { id },
    select: {
      status: true,
      downloadToken: true,
    },
  });
  if (!sale) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({
    status: sale.status,
    downloadToken: sale.status === "PAID" ? sale.downloadToken : null,
  });
}
