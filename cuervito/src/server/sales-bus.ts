import "server-only";

/**
 * In-memory pub/sub for "a sale just got paid" notifications, keyed by
 * sellerId. The /api/dashboard/sales-stream SSE route subscribes; the
 * /api/mp/webhook publishes when a sale flips to PAID.
 *
 * Survives only within the same Node process — fine for a single PM2 worker.
 * If we ever go multi-worker / multi-VPS, swap this for Redis pub/sub.
 */

export type SalePayload = {
  saleId: string;
  amount: number; // total in cents
  itemCount: number;
  eventName: string;
  buyerName: string | null;
  paidAt: string; // ISO
};

type Listener = (payload: SalePayload) => void;

// Use a global so HMR in dev doesn't lose subscribers on every save.
declare global {
  // eslint-disable-next-line no-var
  var __cuervito_sales_bus__: Map<string, Set<Listener>> | undefined;
}
const subscribers: Map<string, Set<Listener>> =
  globalThis.__cuervito_sales_bus__ ?? new Map();
globalThis.__cuervito_sales_bus__ = subscribers;

export function subscribeSales(sellerId: string, listener: Listener): () => void {
  let set = subscribers.get(sellerId);
  if (!set) {
    set = new Set();
    subscribers.set(sellerId, set);
  }
  set.add(listener);
  return () => {
    const s = subscribers.get(sellerId);
    if (!s) return;
    s.delete(listener);
    if (s.size === 0) subscribers.delete(sellerId);
  };
}

export function publishSale(sellerId: string, payload: SalePayload): void {
  const set = subscribers.get(sellerId);
  if (!set) return;
  for (const listener of set) {
    try {
      listener(payload);
    } catch (err) {
      console.error("[sales-bus] listener threw:", err);
    }
  }
}
