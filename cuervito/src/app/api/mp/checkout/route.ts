import { NextResponse, type NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { randomBytes } from "node:crypto";
import { z } from "zod";

import { env } from "~/env";
import { db } from "~/server/db";
import { deliveryEmailHtml, sendEmail } from "~/server/email";
import { createPreference, isMpConfigured } from "~/server/mp";
import { recordPendingAndMaybeNotify } from "~/server/sale-notifier";
import { publishSale } from "~/server/sales-bus";
import { getMpTestMode } from "~/server/settings";

const checkoutSchema = z.object({
  eventId: z.string(),
  photoIds: z.array(z.string()).min(1).max(200),
  buyerEmail: z.string().email(),
  buyerName: z.string().trim().min(1).max(80).optional(),
  buyerPhone: z.string().trim().max(40).optional(),
  discountCode: z.string().trim().max(30).optional(),
});

export async function POST(req: NextRequest) {
  const testMode = await getMpTestMode();

  if (!testMode && !isMpConfigured()) {
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
  if (!testMode && !event.owner.mpAccessToken) {
    return NextResponse.json(
      { error: "El fotógrafo aún no conectó Mercado Pago." },
      { status: 409 },
    );
  }

  // Defensive: confirm all photoIds belong to this event, are uploaded, and
  // not soft-deleted (a buyer can't pay for a photo the photographer removed).
  const photos = await db.photo.findMany({
    where: {
      id: { in: parsed.data.photoIds },
      eventId: event.id,
      fileSize: { not: null },
      deletedAt: null,
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

  // Apply discount
  const now = new Date();
  const activeDiscounts = await db.discount.findMany({
    where: {
      eventId: event.id,
      OR: [{ expires: null }, { expires: { gt: now } }],
    },
  });

  let discountCents = 0;
  let appliedDiscountId: string | null = null;

  const codeInput = parsed.data.discountCode?.toUpperCase();
  if (codeInput) {
    // Try to find a matching CODE discount
    const codeDsc = activeDiscounts.find(
      (d) =>
        d.type === "CODE" &&
        d.code === codeInput &&
        (d.maxUses === null || d.usageCount < d.maxUses),
    );
    if (!codeDsc) {
      return NextResponse.json({ error: "Código de descuento inválido o vencido." }, { status: 400 });
    }
    if (codeDsc.kind === "pct") {
      discountCents = Math.floor((subtotalCents * Number(codeDsc.value)) / 100);
    } else {
      discountCents = Math.min(Math.round(Number(codeDsc.value) * 100), subtotalCents - 1);
    }
    appliedDiscountId = codeDsc.id;
  } else {
    // Find best automatic discount (BUNDLE or QTYPCT) based on photo count
    let bestSavings = 0;
    for (const d of activeDiscounts) {
      if (d.type === "BUNDLE" && d.qty !== null && photos.length >= d.qty && d.price !== null) {
        const bundleTotal = Math.round(Number(d.price) * 100) * photos.length;
        const savings = subtotalCents - bundleTotal;
        if (savings > bestSavings) {
          bestSavings = savings;
          discountCents = savings;
          appliedDiscountId = d.id;
        }
      } else if (d.type === "QTYPCT" && d.qty !== null && photos.length >= d.qty && d.value !== null) {
        const savings = Math.floor((subtotalCents * Number(d.value)) / 100);
        if (savings > bestSavings) {
          bestSavings = savings;
          discountCents = savings;
          appliedDiscountId = d.id;
        }
      }
    }
  }

  const totalCents = Math.max(subtotalCents - discountCents, 0);
  const platformFeeCents = Math.round(
    (totalCents * env.PLATFORM_FEE_PERCENT) / 100,
  );
  const sellerNetCents = totalCents - platformFeeCents;

  // === TEST MODE ===
  // Skip MP entirely: create the Sale already PAID with a downloadToken so
  // we can validate the post-payment UX locally without going through MP.
  if (testMode) {
    const downloadToken = randomBytes(24).toString("hex");
    const tokenExpiresAt = new Date(
      Date.now() + env.DOWNLOAD_TOKEN_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    );

    const [sale] = await db.$transaction([
      db.sale.create({
        data: {
          sellerId: event.ownerId,
          eventId: event.id,
          buyerEmail: parsed.data.buyerEmail,
          buyerName: parsed.data.buyerName ?? null,
          buyerPhone: parsed.data.buyerPhone ?? null,
          subtotalCents,
          discountCents,
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
      }),
      ...(appliedDiscountId
        ? [db.discount.update({ where: { id: appliedDiscountId }, data: { usageCount: { increment: 1 } } })]
        : []),
    ]);

    // Same realtime + cache flow as the real webhook would do.
    publishSale(event.ownerId, {
      saleId: sale.id,
      amount: totalCents,
      itemCount: items.length,
      eventName: event.name,
      buyerName: parsed.data.buyerName ?? null,
      paidAt: new Date().toISOString(),
    });
    revalidateTag(`user:${event.ownerId}:dashboard`);

    // Buyer delivery email + seller notification (same as the webhook path)
    const baseUrl = env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, "");
    void sendEmail({
      to: parsed.data.buyerEmail,
      subject: `Tus fotos · ${event.name}`,
      html: deliveryEmailHtml({
        buyerName: parsed.data.buyerName ?? "Hola",
        eventName: event.name,
        photoCount: items.length,
        downloadUrl: `${baseUrl}/descarga/${downloadToken}`,
      }),
    }).catch((err: unknown) =>
      console.error("[checkout test-mode] delivery email failed:", err),
    );
    void recordPendingAndMaybeNotify(sale.id).catch((err: unknown) =>
      console.error("[checkout test-mode] seller notify failed:", err),
    );

    return NextResponse.json({
      saleId: sale.id,
      // Send the buyer straight to /descarga with ?fresh=1 — the page renders
      // the photo grid AND runs the in-place "Confirmando pago → Pago
      // confirmado → Gracias por tu compra" overlay on top. No intermediate
      // navigation, no loading wheel between states.
      initPoint: `/descarga/${downloadToken}?fresh=1`,
      testMode: true,
    });
  }

  // === REAL MP FLOW ===
  // Create the Sale first (PENDING) — we'll update status from the webhook
  const [sale] = await db.$transaction([
    db.sale.create({
      data: {
        sellerId: event.ownerId,
        eventId: event.id,
        buyerEmail: parsed.data.buyerEmail,
        buyerName: parsed.data.buyerName ?? null,
        buyerPhone: parsed.data.buyerPhone ?? null,
        subtotalCents,
        discountCents,
        totalCents,
        platformFeeCents,
        sellerNetCents,
        status: "PENDING",
        items: {
          create: items.map((i) => ({ photoId: i.photoId, priceCents: i.priceCents })),
        },
      },
      select: { id: true },
    }),
    ...(appliedDiscountId
      ? [db.discount.update({ where: { id: appliedDiscountId }, data: { usageCount: { increment: 1 } } })]
      : []),
  ]);

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
