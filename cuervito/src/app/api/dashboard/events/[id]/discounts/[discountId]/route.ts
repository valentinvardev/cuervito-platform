import { NextResponse, type NextRequest } from "next/server";

import { auth } from "~/server/auth";
import { db } from "~/server/db";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; discountId: string }> },
) {
  const { id, discountId } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const discount = await db.discount.findUnique({
    where: { id: discountId },
    select: { eventId: true, event: { select: { ownerId: true } } },
  });
  if (!discount || discount.event.ownerId !== session.user.id || discount.eventId !== id) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  await db.discount.delete({ where: { id: discountId } });
  return NextResponse.json({ ok: true });
}
