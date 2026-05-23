import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { auth } from "~/server/auth";
import { db } from "~/server/db";

async function assertOwner(eventId: string) {
  const session = await auth();
  if (!session?.user?.id) return null;
  const event = await db.event.findUnique({
    where: { id: eventId },
    select: { ownerId: true },
  });
  if (!event || event.ownerId !== session.user.id) return null;
  return session.user.id;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const userId = await assertOwner(id);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const discounts = await db.discount.findMany({
    where: { eventId: id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true, type: true, code: true, kind: true, value: true,
      qty: true, price: true, expires: true, maxUses: true, usageCount: true, createdAt: true,
    },
  });

  return NextResponse.json(
    discounts.map((d) => ({
      ...d,
      value: d.value ? Number(d.value) : null,
      price: d.price ? Number(d.price) : null,
      expires: d.expires ? d.expires.toISOString() : null,
      createdAt: d.createdAt.toISOString(),
    })),
  );
}

const codeSchema = z.object({
  type: z.literal("CODE"),
  code: z.string().min(2).max(30).transform((v) => v.toUpperCase()),
  kind: z.enum(["pct", "fixed"]),
  value: z.number().positive(),
  expires: z.string().datetime().optional().nullable(),
  maxUses: z.number().int().positive().optional().nullable(),
});

const bundleSchema = z.object({
  type: z.literal("BUNDLE"),
  qty: z.number().int().min(2),
  price: z.number().positive(),
  expires: z.string().datetime().optional().nullable(),
});

const qtypctSchema = z.object({
  type: z.literal("QTYPCT"),
  qty: z.number().int().min(2),
  value: z.number().min(1).max(99),
  expires: z.string().datetime().optional().nullable(),
});

const createSchema = z.discriminatedUnion("type", [codeSchema, bundleSchema, qtypctSchema]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const userId = await assertOwner(id);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", issues: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const discount = await db.discount.create({
    data: {
      eventId: id,
      type: data.type,
      code: data.type === "CODE" ? data.code : null,
      kind: data.type === "CODE" ? data.kind : null,
      value: data.type === "CODE" || data.type === "QTYPCT" ? data.value : null,
      qty: data.type === "BUNDLE" || data.type === "QTYPCT" ? data.qty : null,
      price: data.type === "BUNDLE" ? data.price : null,
      expires: data.expires ? new Date(data.expires) : null,
      maxUses: data.type === "CODE" ? (data.maxUses ?? null) : null,
    },
    select: {
      id: true, type: true, code: true, kind: true, value: true,
      qty: true, price: true, expires: true, maxUses: true, usageCount: true, createdAt: true,
    },
  });

  return NextResponse.json({
    ...discount,
    value: discount.value ? Number(discount.value) : null,
    price: discount.price ? Number(discount.price) : null,
    expires: discount.expires ? discount.expires.toISOString() : null,
    createdAt: discount.createdAt.toISOString(),
  });
}
