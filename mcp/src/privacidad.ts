import { ErrorPrivacidad } from "./errores.js";

/**
 * Lo último que pasa antes de que una respuesta salga del servidor.
 *
 * Tres reglas, y las tres fallan cerrado: si algo no las cumple, la respuesta
 * NO se manda y el agente recibe un error de privacidad.
 *
 * 1. Lista de campos PERMITIDOS, no de prohibidos. Una lista de prohibidos
 *    siempre queda corta: alcanza con que alguien agregue `buyerContact` y no
 *    `buyerEmail` para que pase. Acá cualquier clave que no esté en la lista
 *    corta la respuesta, así que agregar un campo nuevo obliga a pasar por
 *    este archivo y pensarlo.
 *
 * 2. Cada texto se revisa por forma: mails, URLs, IDs de la base (cuid y
 *    uuid), teléfonos, rutas de archivos de S3, tokens. Las consultas son
 *    agregados y no deberían traer nada de eso nunca; esto es por si un día
 *    alguien cambia una consulta y se olvida.
 *
 * 3. Montos con un mínimo de grupo. Un total de ventas de un período con UNA
 *    sola compra es el monto de esa compra. Por debajo de `grupoMinimo`
 *    compras, el total se informa como null con la razón.
 *
 * Lo que esto NO resuelve, y hay que saberlo: dos consultas de períodos que
 * se solapan se pueden restar. Si el lunes-miércoles tuvo 9 compras y el
 * lunes-martes 8, la resta da el monto de la compra del miércoles aunque cada
 * consulta sola pase el mínimo. El monto queda sin nadie asociado —nunca sale
 * quién compró—, pero es un límite del mínimo de grupo y no se esconde.
 */

export const CLAVES_PERMITIDAS: ReadonlySet<string> = new Set([
  // comunes
  "period", "label", "from", "to", "timezone", "generated_at", "unavailable_reason",
  // activación
  "photographers_registered", "photographers_with_event", "photographers_with_photos",
  "registered_no_event", "event_no_photos", "rates", "with_event", "with_photos", "event_to_photos",
  // uso
  "events_created", "photos_uploaded", "face_searches", "dorsal_searches",
  // ventas
  "purchases_count", "purchases_gross", "currency", "amount", "suppressed",
  "payments_failed", "payments_rejected", "failure_rate", "gifts_count",
  // salud
  "status", "photo_processing", "pending", "pending_over_1h", "in_flight", "parked_after_retries",
  "processed_last_hour", "last_success_age_s", "timings", "samples", "median_total_ms",
  "p90_total_ms", "median_download_ms", "window_hours", "payments", "paid", "failed",
  "pending_unconfirmed", "abandoned_checkouts", "errors", "source", "code", "count",
  "alerts", "severity", "message", "aws", "available", "alarms_in_alarm", "alarms", "alarm", "updated_at",
  // semana
  "week", "activation", "usage", "sales", "health_now", "previous_week", "deltas",
  "current", "previous", "change", "change_pct", "alerts_count",
  // ping
  "ok", "service", "version", "timestamp",
  // costos de AWS
  "month", "days_elapsed", "days_in_month", "is_current_month",
  "estimated", "scope", "total_usd", "projected_month_usd", "components",
  "item", "quantity", "unit", "unit_price_usd", "cost_usd", "basis",
  "not_included", "reason", "assumptions", "prices_verified_on", "price_region",
  "measured", "by_service", "forecast_month_end_usd", "age_s", "note",
  "comparison", "rekognition_estimated_usd", "rekognition_measured_usd", "rekognition_ratio",
  "estimated_share_of_account",
]);

const PATRONES_VALOR: ReadonlyArray<RegExp> = [
  /[^\s@<>()"']+@[^\s@<>()"']+\.[a-z]{2,}/i, // mail
  /\bhttps?:\/\/|\bwww\.[a-z0-9-]+\./i, // URL
  /\bc[a-z0-9]{24}\b/, // cuid de Prisma (ids de usuario, evento, venta)
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i, // uuid (ids de foto)
  /\+\d[\d\s().-]{8,}\d/, // teléfono con prefijo internacional
  /(?:^|[\s/])(?:users|events|original|preview|thumb|cuervito)\//i, // clave de S3
  /\beyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\./, // JWT
];

const LARGO_MAXIMO_TEXTO = 500;
const LARGO_MAXIMO_LISTA = 200;

/** Recorre la respuesta entera. Tira ErrorPrivacidad en el primer problema. */
export function verificarSalida(valor: unknown, ruta = "$"): void {
  if (valor === null || typeof valor === "boolean") return;

  if (typeof valor === "number") {
    // NaN o Infinity no son datos personales, pero sí un número inventado: el
    // resultado de dividir por cero que alguien no atajó.
    if (!Number.isFinite(valor)) throw new ErrorPrivacidad(ruta);
    return;
  }

  if (typeof valor === "string") {
    if (valor.length > LARGO_MAXIMO_TEXTO) throw new ErrorPrivacidad(ruta);
    for (const re of PATRONES_VALOR) if (re.test(valor)) throw new ErrorPrivacidad(ruta);
    return;
  }

  if (Array.isArray(valor)) {
    if (valor.length > LARGO_MAXIMO_LISTA) throw new ErrorPrivacidad(ruta);
    valor.forEach((v, i) => verificarSalida(v, `${ruta}[${i}]`));
    return;
  }

  if (typeof valor === "object") {
    for (const [clave, v] of Object.entries(valor)) {
      if (!CLAVES_PERMITIDAS.has(clave)) throw new ErrorPrivacidad(`${ruta}.${clave}`);
      verificarSalida(v, `${ruta}.${clave}`);
    }
    return;
  }

  // undefined, bigint, función, símbolo: nada de eso debería llegar acá.
  throw new ErrorPrivacidad(ruta);
}

/** Un total en unidades de moneda, o null si hay menos compras que el mínimo. */
export function montoProtegido(compras: number, centavos: number, grupoMinimo: number): number | null {
  if (compras < grupoMinimo) return null;
  return Math.round(centavos) / 100;
}

export function razonMontoSuprimido(grupoMinimo: number): string {
  return `Hay menos de ${grupoMinimo} compras en el período: el total podría revelar el monto de una compra individual.`;
}

/** Una proporción con cuatro decimales, o null si el denominador es cero. */
export function tasa(numerador: number, denominador: number): number | null {
  if (!denominador) return null;
  return Math.round((numerador / denominador) * 10_000) / 10_000;
}
