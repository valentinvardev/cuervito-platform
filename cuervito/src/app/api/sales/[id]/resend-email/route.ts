import { NextResponse } from "next/server";

import { auth } from "~/server/auth";
import { esEntregable } from "~/lib/venta";
import { db } from "~/server/db";
import { mailDeEntrega } from "~/server/correos/entrega";
import { sendEmail } from "~/server/email";

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
      downloadToken: true,
      downloadTokenExpires: true,
    },
  });
  if (!sale) return NextResponse.json({ error: "Venta no encontrada" }, { status: 404 });
  if (sale.sellerId !== session.user.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  if (!esEntregable(sale.status) || !sale.downloadToken) {
    return NextResponse.json({ error: "La venta todavía no se entregó" }, { status: 409 });
  }
  if (sale.downloadTokenExpires && sale.downloadTokenExpires < new Date()) {
    return NextResponse.json({ error: "El link de descarga venció" }, { status: 410 });
  }

  // El mismo mail que la entrega original, armado en un solo lugar.
  const mail = await mailDeEntrega(id);
  if (!mail) return NextResponse.json({ error: "La venta todavía no se entregó" }, { status: 409 });

  try {
    await sendEmail(mail);
  } catch (err) {
    console.error("[resend-email] failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Falló el envío" },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
