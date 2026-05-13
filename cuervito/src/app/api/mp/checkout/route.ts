import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";

import { env } from "~/env";
import { db } from "~/server/db";
import { createPreference, isMpConfigured } from "~/server/mp";

const checkoutSchema = z.object({
  eventId: z.string(),
  photoIds: z.array(z.string()).min(1).max(200),
  buyerEmail: z.string().email(),
  buyerName: z.string().trim().min(1).max(80).optional(),
  buyerPhone: z.string().trim().max(40).optional(),
});

export async function POST(req: NextRequest) {
  if (!env.MP_TEST_MODE && !isMpConfigured()) {
    return NextResponse.json(
      { error: "Mercado Pago no está configurado." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const event = await db.event.findUnique({
    where: { id: parsed.data.eventId },
    select: {
      id: true,
      name: true,
      isPublished: true,
      pricePerPhoto: true,
      ownerId: true,
      owner: {
        select: {
          id: true,
          mpAccessToken: true,
          mpConnectedAt: true,
          status: true,
        },
      },
    },
  });

  if (!event || !event.isPublished) {
    return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
  }
  if (event.owner.status !== "ACTIVE") {
    return NextResponse.json(
      { error: "La cuenta del fotógrafo no está activa." },
      { status: 403 },
    );
  }
  if (!env.MP_TEST_MODE && !event.owner.mpAccessToken) {
    return NextResponse.json(
      { error: "El fotógrafo aún no conectó Mercado Pago." },
      { status: 409 },
    );
  }

  // Defensive: confirm all photoIds belong to this event and are uploaded
  const photos = await db.photo.findMany({
    where: {
      id: { in: parsed.data.photoIds },
      eventId: event.id,
      fileSize: { not: null },
    },
    select: { id: true, priceOverride: true },
  });
  if (photos.length === 0) {
    return NextResponse.json({ error: "Fotos inválidas" }, { status: 400 });
  }

  // Compute totals
  const eventPriceCents = Math.round(Number(event.pricePerPhoto) * 100);
  let subtotalCents = 0;
  const items = photos.map((p) => {
    const priceCents = p.priceOverride
      ? Math.round(Number(p.priceOverride) * 100)
      : eventPriceCents;
    subtotalCents += priceCents;
    return { photoId: p.id, priceCents };
  });
  const totalCents = subtotalCents; // no discount logic yet
  const platformFeeCents = Math.round(
    (totalCents * env.PLATFORM_FEE_PERCENT) / 100,
  );
  const sellerNetCents = totalCents - platformFeeCents;

  // === TEST MODE ===
  // Skip MP entirely: create the Sale already PAID with a downloadToken so
  // we can validate the post-payment UX locally without going through MP.
  if (env.MP_TEST_MODE) {
    const downloadToken = randomBytes(24).toString("hex");
    const tokenExpiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

    const sale = await db.sale.create({
      data: {
        sellerId: event.ownerId,
        eventId: event.id,
        buyerEmail: parsed.data.buyerEmail,
        buyerName: parsed.data.buyerName ?? null,
        buyerPhone: parsed.data.buyerPhone ?? null,
        subtotalCents,
        totalCents,
        platformFeeCents,
        sellerNetCents,
        status: "PAID",
        paidAt: new Date(),
        downloadToken,
        downloadTokenExpires: tokenExpiresAt,
        notes: "TEST MODE — payment bypassed",
        items: {
          create: items.map((i) => ({ photoId: i.photoId, priceCents: i.priceCents })),
        },
      },
      select: { id: true },
    });

    return NextResponse.json({
      saleId: sale.id,
      // Path relativo: el cliente hace window.location.href y respeta el host actual
      // (LAN, localhost, prod). No usamos NEXT_PUBLIC_BASE_URL acá porque rompe testing en LAN.
      initPoint: `/descarga/${downloadToken}`,
      testMode: true,
    });
  }

  // === REAL MP FLOW ===
  // Create the Sale first (PENDING) — we'll update status from the webhook
  const sale = await db.sale.create({
    data: {
      sellerId: event.ownerId,
      eventId: event.id,
      buyerEmail: parsed.data.buyerEmail,
      buyerName: parsed.data.buyerName ?? null,
      buyerPhone: parsed.data.buyerPhone ?? null,
      subtotalCents,
      totalCents,
      platformFeeCents,
      sellerNetCents,
      status: "PENDING",
      items: {
        create: items.map((i) => ({ photoId: i.photoId, priceCents: i.priceCents })),
      },
    },
    select: { id: true },
  });

  // Build URLs
  const base =
    env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") ?? new URL(req.url).origin;
  const successUrl = `${base}/pago/exito?sale=${sale.id}`;
  const failureUrl = `${base}/pago/error?sale=${sale.id}`;
  const pendingUrl = `${base}/pago/pendiente?sale=${sale.id}`;
  const notificationUrl = `${base}/api/mp/webhook`;

  try {
    const pref = await createPreference({
      sellerAccessToken: event.owner.mpAccessToken!,
      items: [
        {
          title: `${photos.length} ${photos.length === 1 ? "foto" : "fotos"} · ${event.name}`,
          quantity: 1,
          unitPriceCents: totalCents,
        },
      ],
      marketplaceFeeCents: platformFeeCents,
      buyerEmail: parsed.data.buyerEmail,
      externalReference: sale.id,
      successUrl,
      failureUrl,
      pendingUrl,
      notificationUrl,
    });

    await db.sale.update({
      where: { id: sale.id },
      data: { mpPreferenceId: pref.id },
    });

    // In sandbox, MP exposes a distinct init_point; in production they're the same.
    const initPoint =
      env.MP_ENVIRONMENT === "sandbox" ? pref.sandboxInitPoint : pref.initPoint;

    return NextResponse.json({ saleId: sale.id, initPoint });
  } catch (err) {
    // Mark sale as failed so we don't leave it dangling
    await db.sale
      .update({ where: { id: sale.id }, data: { status: "FAILED" } })
      .catch(() => undefined);
    console.error("[mp checkout] preference failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Checkout falló" },
      { status: 502 },
    );
  }
}
