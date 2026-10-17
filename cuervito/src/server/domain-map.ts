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

/**
 * A dónde se le pide el mapa: a este mismo proceso, por loopback, y NO a la
 * URL pública. Por la URL pública el pedido salía a Cloudflare y volvía, con
 * el bot protection en el medio. Next deja el puerto en process.env.PORT al
 * arrancar (start-server), así que el middleware sabe dónde está el Node que
 * lo acompaña; sin eso, el 3000 de siempre. INTERNAL_ORIGIN lo pisa.
 */
function origenInterno(): string {
  return env.INTERNAL_ORIGIN ?? `http://127.0.0.1:${process.env.PORT ?? "3000"}`;
}

async function reload(): Promise<Map<string, string>> {
  const res = await fetch(`${origenInterno()}/api/interno/domain-map`, {
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
