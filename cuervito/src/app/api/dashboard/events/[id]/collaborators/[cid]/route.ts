import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { auth } from "~/server/auth";
import { db } from "~/server/db";

const patchSchema = z.object({
  commissionScope: z.enum(["NONE", "OWN", "ALL"]).optional(),
  commissionPct: z.coerce.number().int().min(0).max(100).optional(),
});

async function guard(eventId: string, cid: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: 401, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;

  const [event, collab] = await Promise.all([
    db.event.findUnique({ where: { id: eventId }, select: { ownerId: true } }),
    db.eventCollaborator.findUnique({ where: { id: cid }, select: { id: true, eventId: true } }),
  ]);
  if (!event || event.ownerId !== session.user.id) {
    return { error: 404, response: NextResponse.json({ error: "Evento no encontrado" }, { status: 404 }) } as const;
  }
  if (!collab || collab.eventId !== eventId) {
    return { error: 404, response: NextResponse.json({ error: "Colaborador no encontrado" }, { status: 404 }) } as const;
  }
  return { ok: true as const };
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; cid: string }> },
) {
  const { id, cid } = await ctx.params;
  const g = await guard(id, cid);
  if (!("ok" in g)) return g.response;

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const updated = await db.eventCollaborator.update({
    where: { id: cid },
    data: parsed.data,
  });
  return NextResponse.json({
    id: updated.id,
    commissionScope: updated.commissionScope,
    commissionPct: updated.commissionPct,
  });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; cid: string }> },
) {
  const { id, cid } = await ctx.params;
  const g = await guard(id, cid);
  if (!("ok" in g)) return g.response;

  await db.eventCollaborator.delete({ where: { id: cid } });
  return NextResponse.json({ ok: true });
}
