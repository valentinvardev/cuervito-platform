import { NextResponse, type NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { randomBytes } from "node:crypto";

import { env } from "~/env";
import { db } from "~/server/db";
import { deliveryEmailHtml, sendEmail } from "~/server/email";
import { fetchPayment } from "~/server/mp";
import { recordPendingAndMaybeNotify } from "~/server/sale-notifier";
import { publishSale } from "~/server/sales-bus";

async function sendDeliveryEmailForSale(saleId: string): Promise<void> {
  const sale = await db.sale.findUnique({
    where: { id: saleId },
    select: {
      buyerEmail: true,
      buyerName: true,
      downloadToken: true,
      event: { select: { name: true } },
      _count: { select: { items: true } },
    },
  });
  if (!sale?.downloadToken) return;

  const baseUrl = env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, "");
  await sendEmail({
    to: sale.buyerEmail,
    subject: `Tus fotos · ${sale.event.name}`,
    html: deliveryEmailHtml({
      buyerName: sale.buyerName ?? "Hola",
      eventName: sale.event.name,
      photoCount: sale._count.items,
      downloadUrl: `${baseUrl}/descarga/${sale.downloadToken}`,
    }),
  });
}

/**
 * Mercado Pago webhook handler.
 * MP retries non-200 responses for ~24h, so we always try to ack quickly.
 *
 * Note on signing: MP supports HMAC signatures via the x-signature header
 * (configured per-webhook in the MP panel). We don't validate the signature
 * yet — we re-fetch the payment from MP using the seller's access token,
 * which itself acts as a strong authentication. Add signature validation
 * before exposing to a public webhook in production.
 */

type Notification = {
  type?: string;
  action?: string;
  data?: { id?: string | number };
  topic?: string;
  resource?: string;
};

function downloadToken(): string {
  return randomBytes(24).toString("hex");
}

async function handlePayment(paymentId: string) {
  // We need *some* seller access token to fetch the payment. The Sale row
  // tells us which seller owns it via external_reference, but we don't know
  // that yet — so iterate: try recent PENDING sales with mpPaymentId == null
  // first, or just query MP with each candidate token. The simplest is to look
  // up the recent sales and try their seller token.
  //
  // In practice the webhook payload includes `user_id` of the collector,
  // which is the seller's MP user id. We use it to find the seller.
  // We accept either path here: if we can't find by user_id (e.g. the
  // event doesn't have user_id), we fall back to scanning by externalRef
  // after the fact (it's set inside the payment body).

  // Try every recently active seller (small N in dev). For prod we should
  // pre-index by user_id from the webhook payload itself.
  const sellers = await db.user.findMany({
    where: { mpAccessToken: { not: null } },
    select: { id: true, mpAccessToken: true },
    take: 50,
    orderBy: { mpConnectedAt: "desc" },
  });
  if (sellers.length === 0) {
    console.warn("[mp webhook] no sellers connected, dropping payment", paymentId);
    return;
  }

  // First attempt: use the most recently active seller. If the payment isn't
  // theirs MP returns 401/404 — try the next.
  let payment: Awaited<ReturnType<typeof fetchPayment>> | null = null;
  for (const s of sellers) {
    if (!s.mpAccessToken) continue;
    try {
      payment = await fetchPayment({
        paymentId,
        sellerAccessToken: s.mpAccessToken,
      });
      if (payment) break;
    } catch {
      // Not this seller — try next
    }
  }

  if (!payment) {
    console.warn("[mp webhook] could not fetch payment", paymentId);
    return;
  }

  const saleId = payment.externalReference;
  if (!saleId) {
    console.warn("[mp webhook] payment has no external_reference", paymentId);
    return;
  }

  const sale = await db.sale.findUnique({
    where: { id: saleId },
    select: {
      id: true,
      status: true,
      downloadToken: true,
      sellerId: true,
      totalCents: true,
      buyerName: true,
      event: { select: { name: true } },
      _count: { select: { items: true } },
    },
  });
  if (!sale) {
    console.warn("[mp webhook] sale not found:", saleId);
    return;
  }

  const newStatus =
    payment.status === "approved"
      ? "PAID"
      : payment.status === "rejected" || payment.status === "cancelled"
        ? "FAILED"
        : payment.status === "refunded" || payment.status === "charged_back"
          ? "REFUNDED"
          : "PENDING";

  // Generate a download token only when transitioning to PAID for the first
  // time. Token lives DOWNLOAD_TOKEN_RETENTION_DAYS days — the same window the
  // photo files survive on S3 (see /api/cron/cleanup). After that the buyer
  // would 404 anyway because the underlying photos are gone.
  const willIssueToken = newStatus === "PAID" && !sale.downloadToken;
  const tokenExpiresAt = willIssueToken
    ? new Date(Date.now() + env.DOWNLOAD_TOKEN_RETENTION_DAYS * 24 * 60 * 60 * 1000)
    : undefined;

  await db.sale.update({
    where: { id: sale.id },
    data: {
      status: newStatus,
      mpPaymentId: String(payment.id),
      paidAt: newStatus === "PAID" ? new Date() : undefined,
      ...(willIssueToken
        ? { downloadToken: downloadToken(), downloadTokenExpires: tokenExpiresAt }
        : {}),
    },
  });

  // Real-time toast for the seller's dashboard + bust their cached counts.
  // Also send the buyer their download link, and queue the seller email
  // (which batches progressively — see sale-notifier.ts).
  if (newStatus === "PAID" && sale.status !== "PAID") {
    publishSale(sale.sellerId, {
      saleId: sale.id,
      amount: sale.totalCents,
      itemCount: sale._count.items,
      eventName: sale.event.name,
      buyerName: sale.buyerName,
      paidAt: new Date().toISOString(),
    });
    revalidateTag(`user:${sale.sellerId}:dashboard`);

    // Buyer delivery email (best-effort, don't fail webhook on send error)
    void sendDeliveryEmailForSale(sale.id).catch((err: unknown) =>
      console.error("[mp webhook] delivery email failed:", err),
    );

    // Seller notification (queued with progressive batching)
    void recordPendingAndMaybeNotify(sale.id).catch((err: unknown) =>
      console.error("[mp webhook] seller notify failed:", err),
    );
  }

  console.log(
    `[mp webhook] sale=${sale.id} ${sale.status} → ${newStatus} (payment=${payment.id})`,
  );
}

export async function POST(req: NextRequest) {
  let body: Notification = {};
  try {
    body = (await req.json()) as Notification;
  } catch {
    return NextResponse.json({ ok: true }); // ack malformed payloads so MP doesn't retry forever
  }

  const url = new URL(req.url);
  const queryTopic = url.searchParams.get("topic") ?? url.searchParams.get("type");
  const queryId = url.searchParams.get("id") ?? url.searchParams.get("data.id");

  const isPayment =
    body.type === "payment" ||
    body.action?.startsWith("payment.") ||
    body.topic === "payment" ||
    queryTopic === "payment";

  const paymentId =
    body.data?.id?.toString() ??
    (body.resource?.includes("/payments/")
      ? body.resource.split("/").pop()
      : undefined) ??
    queryId ??
    null;

  if (!isPayment || !paymentId) {
    return NextResponse.json({ ok: true });
  }

  try {
    await handlePayment(paymentId);
  } catch (err) {
    console.error("[mp webhook] handlePayment failed:", err);
  }

  return NextResponse.json({ ok: true });
}

// MP sometimes pings with GET to confirm the endpoint exists
export async function GET() {
  return NextResponse.json({ ok: true });
}
