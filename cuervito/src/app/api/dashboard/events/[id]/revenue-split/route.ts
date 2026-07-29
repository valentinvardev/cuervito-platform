import { NextResponse, type NextRequest } from "next/server";

import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { resolveAvatarUrl } from "~/server/avatar";

/**
 * Desglose de la recaudación del evento por vendedor.
 *
 * Solo el dueño lo ve: expone montos de toda la galería, incluida la
 * comisión que le debe a cada colaborador.
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: eventId } = await ctx.params;

  const event = await db.event.findUnique({
    where: { id: eventId },
    select: {
      ownerId: true,
      owner: { select: { id: true, name: true, email: true, image: true } },
    },
  });
  if (!event || event.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
  }

  const sales = await db.sale.findMany({
    where: { eventId, status: "PAID" },
    select: {
      id: true,
      totalCents: true,
      sellerNetCents: true,
      items: {
        select: {
          priceCents: true,
          photo: {
            select: {
              uploadedById: true,
              uploadedBy: { select: { id: true, name: true, email: true, image: true } },
            },
          },
        },
      },
    },
  });

  const commissions = await db.saleCommission.groupBy({
    by: ["userId"],
    where: { sale: { eventId } },
    _sum: { amountCents: true },
    _count: true,
  });

  type Row = {
    userId: string;
    name: string | null;
    email: string | null;
    image: string | null;
    photosSold: number;
    grossCents: number;
    isOwner: boolean;
    commissionCents: number;
  };

  const byUser = new Map<string, Row>();
  const ensure = (
    u: { id: string; name: string | null; email: string | null; image: string | null },
  ): Row => {
    let r = byUser.get(u.id);
    if (!r) {
      r = {
        userId: u.id,
        name: u.name,
        email: u.email,
        image: u.image,
        photosSold: 0,
        grossCents: 0,
        isOwner: u.id === event.ownerId,
        commissionCents: 0,
      };
      byUser.set(u.id, r);
    }
    return r;
  };

  // El dueño siempre aparece, aunque no haya subido nada.
  ensure(event.owner);

  let totalNet = 0;
  let unattributed = 0;
  for (const s of sales) {
    totalNet += s.sellerNetCents;
    for (const it of s.items) {
      const up = it.photo?.uploadedBy;
      if (!up) {
        // Fotos anteriores a que existiera uploadedById.
        unattributed += it.priceCents;
        continue;
      }
      const row = ensure(up);
      row.photosSold += 1;
      row.grossCents += it.priceCents;
    }
  }

  for (const c of commissions) {
    const row = byUser.get(c.userId);
    if (row) row.commissionCents = c._sum.amountCents ?? 0;
  }

  const rows = [...byUser.values()];
  const avatars = await Promise.all(rows.map((r) => resolveAvatarUrl(r.image)));
  const totalCommission = rows.reduce((a, r) => a + r.commissionCents, 0);

  return NextResponse.json({
    totalNetCents: totalNet,
    totalCommissionCents: totalCommission,
    /** Lo que le queda al dueño después de pagar comisiones. */
    ownerKeepsCents: totalNet - totalCommission,
    unattributedCents: unattributed,
    sellers: rows
      .map((r, i) => ({ ...r, image: avatars[i] ?? null }))
      .sort((a, b) => Number(b.isOwner) - Number(a.isOwner) || b.grossCents - a.grossCents),
  });
}
