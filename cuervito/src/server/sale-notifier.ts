import "server-only";

import { db } from "~/server/db";
import {
  saleEmailBigBatchHtml,
  saleEmailSingleHtml,
  saleEmailSmallBatchHtml,
  sendEmail,
  type SaleItemSummary,
} from "~/server/email";

/**
 * Progressive seller notification policy. Per seller, per AR day (UTC-3):
 *
 *   sales 1, 2, 3  → email each one individually
 *   sales 4..10    → email every 2 sales (so batches of 2)
 *   sales 11+      → email every 5 sales (batches of 5)
 *
 * Sales arrive via the MP webhook. Each new PAID sale calls
 * recordPendingAndMaybeNotify(saleId). The function:
 *   1. Inserts a PendingSaleNotification row.
 *   2. Counts how many sales the seller has had so far today (PAID).
 *   3. Counts how many are still pending (sentAt = null) for this seller.
 *   4. Decides whether to flush now and with which template variant.
 */

// AR is UTC-3 year-round (no DST since 2010).
const AR_OFFSET_MS = -3 * 60 * 60 * 1000;

function startOfArDay(now = new Date()): Date {
  const arNow = new Date(now.getTime() + AR_OFFSET_MS);
  arNow.setUTCHours(0, 0, 0, 0);
  return new Date(arNow.getTime() - AR_OFFSET_MS);
}

/**
 * Given how many sales the seller has had today (including the current one)
 * and how many are currently pending, decide whether we should flush now.
 *
 * Tier 1 (sales 1..3): flush every sale → batchSize = 1
 * Tier 2 (sales 4..10): flush when 2 are pending → batchSize = 2
 * Tier 3 (sales 11+):   flush when 5 are pending → batchSize = 5
 *
 * Edge case: when we transition between tiers we still flush whatever is
 * pending so nothing gets stuck (e.g. sale #4 alone shouldn't wait for #5
 * forever if there's no more sales that day).
 */
function shouldFlush(salesTodaySoFar: number, pendingCount: number): boolean {
  if (salesTodaySoFar <= 3) return true; // tier 1: individual
  if (salesTodaySoFar <= 10) return pendingCount >= 2; // tier 2: by 2
  return pendingCount >= 5; // tier 3: by 5
}

export async function recordPendingAndMaybeNotify(saleId: string): Promise<void> {
  const sale = await db.sale.findUnique({
    where: { id: saleId },
    select: {
      id: true,
      sellerId: true,
      status: true,
      paidAt: true,
    },
  });
  if (!sale || sale.status !== "PAID") return;

  // 1. Insert pending row idempotently (saleId is @unique).
  try {
    await db.pendingSaleNotification.create({
      data: { saleId: sale.id, sellerId: sale.sellerId },
    });
  } catch {
    // Duplicate → already recorded (webhook retry). Just continue.
  }

  // 2. How many PAID sales today total (AR day), and how many are pending?
  const dayStart = startOfArDay();

  const [salesTodayCount, pendingForSeller] = await Promise.all([
    db.sale.count({
      where: {
        sellerId: sale.sellerId,
        status: "PAID",
        paidAt: { gte: dayStart },
      },
    }),
    db.pendingSaleNotification.findMany({
      where: { sellerId: sale.sellerId, sentAt: null },
      orderBy: { createdAt: "asc" },
      select: { id: true, saleId: true },
    }),
  ]);

  if (!shouldFlush(salesTodayCount, pendingForSeller.length)) {
    return; // wait for the next sale
  }

  await flushPending(sale.sellerId, pendingForSeller.map((p) => p.saleId));
}

export async function flushPending(
  sellerId: string,
  saleIds: string[],
): Promise<void> {
  if (saleIds.length === 0) return;

  const [seller, sales] = await Promise.all([
    db.user.findUnique({
      where: { id: sellerId },
      select: { name: true, email: true },
    }),
    db.sale.findMany({
      where: { id: { in: saleIds } },
      select: {
        id: true,
        totalCents: true,
        sellerNetCents: true,
        buyerName: true,
        paidAt: true,
        event: { select: { name: true } },
        _count: { select: { items: true } },
      },
    }),
  ]);

  if (!seller?.email || sales.length === 0) return;

  const summaries: SaleItemSummary[] = sales.map((s) => ({
    eventName: s.event.name,
    itemCount: s._count.items,
    totalCents: s.totalCents,
    sellerNetCents: s.sellerNetCents,
    buyerName: s.buyerName,
    paidAt: (s.paidAt ?? new Date()).toISOString(),
  }));

  const photographerName = seller.name ?? "Hola";

  let html: string;
  let subject: string;
  if (summaries.length === 1) {
    const only = summaries[0]!;
    html = saleEmailSingleHtml({ photographerName, sale: only });
    subject = `Venta nueva · $${(only.sellerNetCents / 100).toLocaleString("es-AR")}`;
  } else if (summaries.length <= 4) {
    html = saleEmailSmallBatchHtml({ photographerName, sales: summaries });
    subject = `${summaries.length} ventas nuevas en cuervito`;
  } else {
    html = saleEmailBigBatchHtml({ photographerName, sales: summaries });
    subject = `${summaries.length} ventas seguidas — estás en racha`;
  }

  try {
    await sendEmail({ to: seller.email, subject, html });
  } catch (err) {
    console.error("[sale-notifier] send failed, leaving pending:", err);
    return; // leave sentAt null so we retry on the next sale
  }

  await db.pendingSaleNotification.updateMany({
    where: { saleId: { in: saleIds }, sentAt: null },
    data: { sentAt: new Date() },
  });
}
