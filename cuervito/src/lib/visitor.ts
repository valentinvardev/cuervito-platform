/**
 * Identidad anónima del visitante y atribución de primer contacto.
 *
 * Dos cookies, ambas de 7 días:
 *   cuervito_vid — id aleatorio para atar búsquedas por selfie a la compra
 *   cuervito_src — de dónde llegó la primera vez (PLATFORM | DIRECT)
 *
 * La atribución es de **primer contacto**: si alguien descubre un evento
 * desde el buscador de Cuervito, se va, y vuelve por el link que le pasó
 * el fotógrafo, la venta sigue contando como PLATFORM. Es la lectura
 * conservadora desde el punto de vista del fotógrafo — no le cobramos
 * comisión alta por una venta que él generó, pero sí reconocemos cuando
 * el descubrimiento lo aportó la plataforma.
 *
 * No hay datos personales: el id es aleatorio y no se cruza con nada.
 */

export const VISITOR_COOKIE = "cuervito_vid";
export const SOURCE_COOKIE = "cuervito_src";
export const COOKIE_DAYS = 7;

export type TrafficSource = "PLATFORM" | "DIRECT" | "UNKNOWN";

/** Valores válidos del parámetro `?src=` que ponen los links internos. */
const PLATFORM_MARKERS = new Set(["search", "strip", "landing"]);

export function parseTrafficSource(raw: string | null | undefined): TrafficSource {
  if (!raw) return "UNKNOWN";
  if (raw === "PLATFORM" || raw === "DIRECT") return raw;
  return PLATFORM_MARKERS.has(raw) ? "PLATFORM" : "UNKNOWN";
}

/** Lee una cookie del `document`. Solo cliente. */
export function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${name}=([^;]*)`),
  );
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export function writeCookie(name: string, value: string): void {
  if (typeof document === "undefined") return;
  const maxAge = COOKIE_DAYS * 24 * 60 * 60;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}
