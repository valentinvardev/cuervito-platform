import "server-only";

/**
 * Rate limit en memoria, por proceso.
 *
 * El deploy es un único proceso PM2 en un VPS, así que un Map alcanza y no
 * agrega dependencias ni latencia. Si algún día hay más de una instancia esto
 * pasa a ser un límite *por instancia*: multiplicá los topes por la cantidad
 * de procesos o movelo a Redis.
 *
 * Se usa para frenar endpoints que gastan plata por request — hoy la búsqueda
 * por selfie, que llama a Rekognition sin que haya una sesión detrás.
 */

export type LimitRule = {
  /** Máximo de eventos permitidos dentro de la ventana. */
  limit: number;
  windowMs: number;
};

export type LimitResult =
  | { ok: true }
  | { ok: false; retryAfterSec: number };

/** key → timestamps de los hits recientes, en orden ascendente. */
const HITS = new Map<string, number[]>();

const SWEEP_EVERY_MS = 5 * 60_000;
let lastSweep = Date.now();

/** Descarta las claves que ya no tienen hits vigentes para que el Map no crezca
 *  sin techo con un atacante que rota IPs. */
function sweep(now: number, horizonMs: number): void {
  if (now - lastSweep < SWEEP_EVERY_MS) return;
  lastSweep = now;
  for (const [key, hits] of HITS) {
    const live = hits.filter((t) => now - t < horizonMs);
    if (live.length === 0) HITS.delete(key);
    else HITS.set(key, live);
  }
}

/**
 * Registra un intento contra `key` y decide si pasa.
 *
 * Todas las reglas se evalúan juntas: alcanza con que una se pase de rosca
 * para rechazar, y el hit no se cuenta cuando se rechaza (así un atacante que
 * insiste no se extiende su propio castigo indefinidamente, pero tampoco
 * avanza).
 */
export function hitRateLimit(key: string, rules: LimitRule[]): LimitResult {
  const now = Date.now();
  const horizon = Math.max(...rules.map((r) => r.windowMs));
  const hits = (HITS.get(key) ?? []).filter((t) => now - t < horizon);

  for (const rule of rules) {
    const inWindow = hits.filter((t) => now - t < rule.windowMs);
    if (inWindow.length >= rule.limit) {
      HITS.set(key, hits);
      const oldest = inWindow[0]!;
      return {
        ok: false,
        retryAfterSec: Math.max(1, Math.ceil((rule.windowMs - (now - oldest)) / 1000)),
      };
    }
  }

  hits.push(now);
  HITS.set(key, hits);
  sweep(now, horizon);
  return { ok: true };
}

/** IP del cliente detrás del reverse proxy. Sin esto todos los requests
 *  comparten la IP del proxy y el límite sería global. */
export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return headers.get("x-real-ip")?.trim() ?? "desconocida";
}
