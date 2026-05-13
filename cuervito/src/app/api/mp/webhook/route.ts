import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "node:crypto";

import { db } from "~/server/db";
import { fetchPayment } from "~/server/mp";

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
    select: { id: true, status: true, downloadToken: true },
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

  // Generate a download token only when transitioning to PAID for the first time
  const willIssueToken = newStatus === "PAID" && !sale.downloadToken;
  const tokenExpiresAt = willIssueToken ? new Date(Date.now() + 72 * 60 * 60 * 1000) : undefined;

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
