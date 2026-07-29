import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { auth } from "~/server/auth";
import { db } from "~/server/db";

const inviteSchema = z.object({
  email: z.string().email().transform((s) => s.toLowerCase().trim()),
  commissionScope: z.enum(["NONE", "OWN", "ALL"]),
  commissionPct: z.coerce.number().int().min(0).max(100),
});

/** Listar colaboradores del evento (solo el owner puede). */
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
    select: { ownerId: true },
  });
  if (!event || event.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
  }

  const rows = await db.eventCollaborator.findMany({
    where: { eventId },
    orderBy: { invitedAt: "desc" },
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
    },
  });

  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      email: r.invitedEmail,
      userId: r.userId,
      userName: r.user?.name ?? null,
      userEmail: r.user?.email ?? null,
      userImage: r.user?.image ?? null,
      commissionScope: r.commissionScope,
      commissionPct: r.commissionPct,
      status: r.status,
      invitedAt: r.invitedAt.toISOString(),
      acceptedAt: r.acceptedAt?.toISOString() ?? null,
    })),
  );
}

/** Invitar un colaborador. Crea un EventCollaborator PENDING. Si el
 *  email ya tiene cuenta en la plataforma lo linkea con userId. */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: eventId } = await ctx.params;

  const event = await db.event.findUnique({
    where: { id: eventId },
    select: { ownerId: true },
  });
  if (!event || event.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // No dejar que el owner se invite a sí mismo.
  const ownerEmail = (
    await db.user.findUnique({
      where: { id: session.user.id },
      select: { email: true },
    })
  )?.email?.toLowerCase();
  if (parsed.data.email === ownerEmail) {
    return NextResponse.json(
      { error: "Ya sos el fotógrafo host de este evento." },
      { status: 400 },
    );
  }

  const existingUser = await db.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true },
  });

  try {
    const created = await db.eventCollaborator.create({
      data: {
        eventId,
        invitedEmail: parsed.data.email,
        userId: existingUser?.id,
        invitedById: session.user.id,
        commissionScope: parsed.data.commissionScope,
        commissionPct: parsed.data.commissionPct,
        status: "PENDING",
      },
    });

    // TODO: enviar email real. Por ahora sólo log — la próxima iteración
    // agrega provider (Resend/SES).
    console.info(
      "[collaborators] invite created",
      JSON.stringify({
        eventId,
        email: created.invitedEmail,
        token: created.inviteToken,
        userExists: !!existingUser,
      }),
    );

    return NextResponse.json({
      id: created.id,
      inviteToken: created.inviteToken,
    });
  } catch (err: unknown) {
    // Unique constraint (eventId, invitedEmail)
    if ((err as { code?: string }).code === "P2002") {
      return NextResponse.json(
        { error: "Ya invitaste a esta persona a este evento." },
        { status: 409 },
      );
    }
    throw err;
  }
}
