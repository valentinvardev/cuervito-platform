import { NextResponse } from "next/server";

import { env } from "~/env";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { downloadEmailHtml, sendEmail } from "~/server/email";

export async function POST(
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
      status: true,
      buyerEmail: true,
      buyerName: true,
      downloadToken: true,
      downloadTokenExpires: true,
      event: { select: { name: true } },
      _count: { select: { items: true } },
    },
  });
  if (!sale) return NextResponse.json({ error: "Venta no encontrada" }, { status: 404 });
  if (sale.sellerId !== session.user.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  if (sale.status !== "PAID" || !sale.downloadToken) {
    return NextResponse.json({ error: "La venta no está pagada" }, { status: 409 });
  }
  if (sale.downloadTokenExpires && sale.downloadTokenExpires < new Date()) {
    return NextResponse.json({ error: "El link de descarga venció" }, { status: 410 });
  }

  const downloadUrl = `${env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, "")}/descarga/${sale.downloadToken}`;

  try {
    await sendEmail({
      to: sale.buyerEmail,
      subject: `Tus fotos · ${sale.event.name}`,
      html: downloadEmailHtml({
        buyerName: sale.buyerName ?? "Hola",
        eventName: sale.event.name,
        photoCount: sale._count.items,
        downloadUrl,
      }),
    });
  } catch (err) {
    console.error("[resend-email] failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Falló el envío" },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
