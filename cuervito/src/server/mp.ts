import "server-only";

import { env } from "~/env";

/**
 * Mercado Pago — marketplace integration helpers.
 *
 * Architecture:
 *  - The platform (Cuervito) is the "marketplace owner".
 *  - Each photographer connects their own MP account via OAuth.
 *  - When a buyer pays for photos, we create a Preference using the
 *    photographer's access_token and add `marketplace_fee` to retain 10%.
 *  - The funds go directly to the photographer's MP account; our cut is
 *    automatically routed to our app's account.
 */

const MP_API = "https://api.mercadopago.com";
const MP_OAUTH_URL = "https://auth.mercadopago.com.ar/authorization";

export function isMpConfigured(): boolean {
  return !!env.MP_CLIENT_ID && !!env.MP_CLIENT_SECRET;
}

/** Build the OAuth URL the photographer is redirected to. */
export function buildOAuthUrl(opts: { state: string; redirectUri: string }): string {
  const params = new URLSearchParams({
    client_id: env.MP_CLIENT_ID ?? "",
    response_type: "code",
    platform_id: "mp",
    redirect_uri: opts.redirectUri,
    state: opts.state,
  });
  return `${MP_OAUTH_URL}?${params.toString()}`;
}

/** Exchange an OAuth code for tokens. */
export async function exchangeOAuthCode(opts: {
  code: string;
  redirectUri: string;
}): Promise<{
  accessToken: string;
  refreshToken: string;
  publicKey: string;
  userId: number;
  liveMode: boolean;
  expiresInSeconds: number;
}> {
  const body = new URLSearchParams({
    client_id: env.MP_CLIENT_ID ?? "",
    client_secret: env.MP_CLIENT_SECRET ?? "",
    grant_type: "authorization_code",
    code: opts.code,
    redirect_uri: opts.redirectUri,
  });

  const res = await fetch(`${MP_API}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`MP OAuth exchange failed: ${res.status} ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    public_key: string;
    user_id: number;
    live_mode: boolean;
    expires_in: number;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    publicKey: data.public_key,
    userId: data.user_id,
    liveMode: data.live_mode,
    expiresInSeconds: data.expires_in,
  };
}

/** Refresh a seller's tokens using the saved refresh_token. */
export async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
}> {
  const body = new URLSearchParams({
    client_id: env.MP_CLIENT_ID ?? "",
    client_secret: env.MP_CLIENT_SECRET ?? "",
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const res = await fetch(`${MP_API}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`MP token refresh failed: ${res.status} ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresInSeconds: data.expires_in,
  };
}

/**
 * Create a Checkout Pro preference using the seller's access token.
 * Sets `marketplace_fee` to retain the platform commission.
 */
export type PreferenceItem = {
  title: string;
  quantity: number;
  unitPriceCents: number;
};

export async function createPreference(opts: {
  sellerAccessToken: string;
  items: PreferenceItem[];
  marketplaceFeeCents: number;
  buyerEmail: string;
  externalReference: string;
  successUrl: string;
  failureUrl: string;
  pendingUrl: string;
  notificationUrl: string;
}): Promise<{
  id: string;
  initPoint: string;
  sandboxInitPoint: string;
}> {
  const payload = {
    items: opts.items.map((i) => ({
      title: i.title,
      quantity: i.quantity,
      unit_price: i.unitPriceCents / 100,
      currency_id: "ARS",
    })),
    marketplace: "Cuervito",
    marketplace_fee: opts.marketplaceFeeCents / 100,
    payer: { email: opts.buyerEmail },
    back_urls: {
      success: opts.successUrl,
      failure: opts.failureUrl,
      pending: opts.pendingUrl,
    },
    auto_return: "approved",
    notification_url: opts.notificationUrl,
    external_reference: opts.externalReference,
    statement_descriptor: "CUERVITO",
  };

  const res = await fetch(`${MP_API}/checkout/preferences`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.sellerAccessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`MP preference creation failed: ${res.status} ${text.slice(0, 400)}`);
  }

  const data = (await res.json()) as {
    id: string;
    init_point: string;
    sandbox_init_point: string;
  };

  return {
    id: data.id,
    initPoint: data.init_point,
    sandboxInitPoint: data.sandbox_init_point,
  };
}

/** Fetch a payment's full detail (called from the webhook handler). */
export async function fetchPayment(opts: {
  paymentId: string;
  sellerAccessToken: string;
}): Promise<{
  id: number;
  status: string;
  statusDetail: string;
  externalReference: string | null;
  amount: number;
  feeAmount: number;
}> {
  const res = await fetch(`${MP_API}/v1/payments/${opts.paymentId}`, {
    headers: { Authorization: `Bearer ${opts.sellerAccessToken}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`MP fetch payment failed: ${res.status} ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    id: number;
    status: string;
    status_detail: string;
    external_reference: string | null;
    transaction_amount: number;
    fee_details?: Array<{ amount: number }>;
  };
  const feeAmount =
    data.fee_details?.reduce((a, b) => a + (b.amount ?? 0), 0) ?? 0;
  return {
    id: data.id,
    status: data.status,
    statusDetail: data.status_detail,
    externalReference: data.external_reference,
    amount: data.transaction_amount,
    feeAmount,
  };
}
