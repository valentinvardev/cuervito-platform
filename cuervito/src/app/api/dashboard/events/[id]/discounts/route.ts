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

  /* Que no entren dos veces el mismo.

     La pantalla ya bloquea el botón mientras guarda, así que el doble click
     no es el problema: el problema es todo lo demás. Dos pestañas abiertas,
     un pedido que falló en la red pero llegó igual, o simplemente volver la
     semana que viene y cargar de nuevo el pack de 5 sin acordarse de que ya
     estaba.

     Y duplicado no significa lo mismo en cada tipo:

     · CODE  — el mismo código dos veces está roto, no repetido. El canje
               busca el primero que encuentra, así que el segundo es un cupón
               que existe en la base y no se aplica nunca.
     · BUNDLE / QTYPCT — la clave es la CANTIDAD. Dos reglas para «5 o más»
               se contradicen entre sí, y la tienda termina eligiendo una por
               un criterio que el fotógrafo nunca decidió.

     Los VENCIDOS no cuentan: renovar un código que ya expiró es legítimo y
     es justamente lo que uno querría poder hacer. */
  const vigente = { OR: [{ expires: null }, { expires: { gt: new Date() } }] };
  const repetido = await db.discount.findFirst({
    where:
      data.type === "CODE"
        ? { eventId: id, type: "CODE", code: data.code, ...vigente }
        : { eventId: id, type: data.type, qty: data.qty, ...vigente },
    select: { id: true },
  });
  if (repetido) {
    return NextResponse.json(
      {
        error:
          data.type === "CODE"
            ? `Ya tenés un código ${data.code} activo en este evento.`
            : `Ya tenés un descuento para ${data.qty} fotos o más. Borrá el que está antes de cargar otro.`,
      },
      { status: 409 },
    );
  }

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
