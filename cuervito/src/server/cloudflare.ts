import "server-only";

import { env } from "~/env";

/**
 * Thin client for Cloudflare for SaaS' "Custom Hostnames" API.
 * Docs: https://developers.cloudflare.com/cloudflare-for-saas/
 *
 * Flow:
 *   1. User adds their domain via /dashboard/tienda
 *   2. createCustomHostname() registers it with Cloudflare. Response includes
 *      the DNS records the user has to set up.
 *   3. We poll getCustomHostname() to check verification status. Cloudflare
 *      auto-issues a Let's Encrypt cert once DNS is correct.
 *   4. We surface status to the user in the dashboard.
 */

const API = "https://api.cloudflare.com/client/v4";

function ensureConfigured() {
  if (!env.CLOUDFLARE_API_TOKEN || !env.CLOUDFLARE_ZONE_ID) {
    throw new Error(
      "Cloudflare for SaaS is not configured. Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ZONE_ID.",
    );
  }
}

export function isCfConfigured(): boolean {
  return !!(env.CLOUDFLARE_API_TOKEN && env.CLOUDFLARE_ZONE_ID);
}

type CfResponse<T> = {
  success: boolean;
  errors: { code: number; message: string }[];
  messages: { code: number; message: string }[];
  result: T;
};

export type CustomHostnameStatus =
  | "pending"
  | "active"
  | "active_redeploying"
  | "moved"
  | "pending_deletion"
  | "deleted"
  | "pending_blocked"
  | "pending_migration"
  | "provisioned"
  | "blocked";

export type CustomHostnameOwnershipVerification = {
  type: string;
  name?: string;
  value?: string;
};

export type CustomHostnameSSL = {
  status: string;
  validation_records?: {
    txt_name?: string;
    txt_value?: string;
    http_url?: string;
    http_body?: string;
  }[];
  validation_errors?: { message: string }[];
};

export type CustomHostname = {
  id: string;
  hostname: string;
  status: CustomHostnameStatus;
  ssl: CustomHostnameSSL;
  ownership_verification?: CustomHostnameOwnershipVerification;
  ownership_verification_http?: { http_url: string; http_body: string };
  created_at: string;
  verification_errors?: string[];
};

async function call<T>(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  ensureConfigured();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
    "Content-Type": "application/json",
  };
  if (init?.headers) {
    Object.assign(headers, init.headers as Record<string, string>);
  }
  const body = init?.json !== undefined ? JSON.stringify(init.json) : init?.body;
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers,
    body,
  });
  const data = (await res.json()) as CfResponse<T>;
  if (!res.ok || !data.success) {
    const msg = data.errors?.[0]?.message ?? `Cloudflare API error ${res.status}`;
    throw new Error(msg);
  }
  return data.result;
}

/**
 * Register a hostname under our zone. Cloudflare returns the DNS records the
 * user needs to set up on their registrar.
 */
export async function createCustomHostname(
  hostname: string,
): Promise<CustomHostname> {
  return call<CustomHostname>(`/zones/${env.CLOUDFLARE_ZONE_ID}/custom_hostnames`, {
    method: "POST",
    json: {
      hostname,
      ssl: {
        method: "http",
        type: "dv",
        settings: {
          min_tls_version: "1.2",
        },
      },
    },
  });
}

/** Poll status of a hostname (use after createCustomHostname to refresh). */
export async function getCustomHostname(id: string): Promise<CustomHostname> {
  return call<CustomHostname>(
    `/zones/${env.CLOUDFLARE_ZONE_ID}/custom_hostnames/${id}`,
  );
}

export async function deleteCustomHostname(id: string): Promise<void> {
  await call<unknown>(
    `/zones/${env.CLOUDFLARE_ZONE_ID}/custom_hostnames/${id}`,
    { method: "DELETE" },
  );
}

/** Tell Cloudflare to retry verification (force a cert check). */
export async function retryCustomHostname(id: string): Promise<CustomHostname> {
  return call<CustomHostname>(
    `/zones/${env.CLOUDFLARE_ZONE_ID}/custom_hostnames/${id}`,
    {
      method: "PATCH",
      json: { ssl: { method: "http", type: "dv" } },
    },
  );
}
