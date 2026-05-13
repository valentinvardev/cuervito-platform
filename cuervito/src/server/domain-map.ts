import "server-only";

import { db } from "~/server/db";

/**
 * In-memory lookup for active custom domains.
 *   "www.anaphoto.com.ar" → "ana-liotta"
 *
 * Refreshed every 60s. For ~hundreds of photographers this is cheap and
 * avoids hitting the DB on every storefront request. For thousands, swap
 * for Redis or move to an edge cache.
 *
 * Survives HMR via globalThis.
 */

declare global {
  // eslint-disable-next-line no-var
  var __cuervito_domain_map__: { map: Map<string, string>; loadedAt: number } | undefined;
}

const TTL_MS = 60_000;

async function reload(): Promise<Map<string, string>> {
  const rows = await db.customDomain.findMany({
    where: { status: "ACTIVE" },
    select: {
      hostname: true,
      user: { select: { slug: true } },
    },
  });
  const map = new Map<string, string>();
  for (const r of rows) {
    if (r.user.slug) {
      map.set(r.hostname.toLowerCase(), r.user.slug);
    }
  }
  return map;
}

/** Resolve a hostname to a photographer slug, or null if not a custom domain. */
export async function resolveSlugForHost(host: string): Promise<string | null> {
  const h = host.toLowerCase();
  const cached = globalThis.__cuervito_domain_map__;
  const now = Date.now();

  if (cached && now - cached.loadedAt < TTL_MS) {
    return cached.map.get(h) ?? null;
  }

  try {
    const map = await reload();
    globalThis.__cuervito_domain_map__ = { map, loadedAt: now };
    return map.get(h) ?? null;
  } catch (err) {
    console.error("[domain-map] reload failed:", err);
    // Fallback to stale cache if present, otherwise treat as no match.
    return cached?.map.get(h) ?? null;
  }
}

/** Force-refresh the cache (call after adding/removing a domain). */
export function invalidateDomainMap(): void {
  globalThis.__cuervito_domain_map__ = undefined;
}
