import { env } from "~/env";

/**
 * In-memory lookup for active custom domains.
 *   "www.anaphoto.com.ar" → "ana-liotta"
 *
 * Refreshed every 60s. This module runs from the Edge middleware, which can't
 * use Prisma, so the reload fetches an internal Node API route instead of
 * hitting the DB directly. Payload is a small JSON list of [host, slug] pairs.
 *
 * Survives HMR via globalThis.
 */

declare global {
  // eslint-disable-next-line no-var
  var __cuervito_domain_map__: { map: Map<string, string>; loadedAt: number } | undefined;
}

const TTL_MS = 60_000;

async function reload(): Promise<Map<string, string>> {
  const base = env.NEXT_PUBLIC_BASE_URL.replace(/\/+$/, "");
  const res = await fetch(`${base}/api/_internal/domain-map`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`domain-map fetch failed: ${res.status}`);
  const data = (await res.json()) as { entries: [string, string][] };
  return new Map(data.entries);
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
