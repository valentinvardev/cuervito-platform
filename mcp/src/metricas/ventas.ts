import type { Consulta } from "../db.js";
import { aTimestamp, type Periodo } from "../periodo.js";
import { montoProtegido, razonMontoSuprimido, tasa } from "../privacidad.js";

/**
 * Ventas: sólo totales del período, por moneda.
 *
 * Una compra es una venta PAID, con la misma definición que el panel de
 * métricas del admin, para que los dos números coincidan. Cuenta por la fecha
 * en que se pagó (`paidAt`), y por la de creación si no tiene: una venta
 * creada el domingo y pagada el lunes es del lunes.
 *
 * Los regalos (GIFT) van aparte: no son plata cobrada y no entran en el bruto.
 *
 * Los rechazos NO se pueden separar de los fallos. El webhook de Mercado Pago
 * guarda `rejected` y `cancelled` los dos como FAILED, y ahí se pierde la
 * diferencia. `payments_rejected` sale como null con la razón; los rechazos
 * están adentro de `payments_failed`.
 *
 * La tasa de fallos es fallidas sobre (pagadas + fallidas). Las PENDING no
 * entran: casi todas son checkouts que alguien abrió y abandonó, y no un pago
 * que falló.
 */
export const SQL_VENTAS = `
select
  currency as moneda,
  count(*) filter (
    where status = 'PAID'
      and coalesce("paidAt", "createdAt") >= $1::timestamp
      and coalesce("paidAt", "createdAt") <  $2::timestamp
  )::int as pagadas,
  coalesce(sum("totalCents") filter (
    where status = 'PAID'
      and coalesce("paidAt", "createdAt") >= $1::timestamp
      and coalesce("paidAt", "createdAt") <  $2::timestamp
  ), 0)::bigint as bruto_centavos,
  count(*) filter (
    where status = 'FAILED' and "createdAt" >= $1::timestamp and "createdAt" < $2::timestamp
  )::int as fallidas,
  count(*) filter (
    where status = 'GIFT' and "createdAt" >= $1::timestamp and "createdAt" < $2::timestamp
  )::int as regalos
from "Sale"
where ("createdAt" >= $1::timestamp and "createdAt" < $2::timestamp)
   or ("paidAt"    >= $1::timestamp and "paidAt"    < $2::timestamp)
group by currency
`;

type Fila = { moneda: string; pagadas: number; bruto_centavos: string | number; fallidas: number; regalos: number };

export const RAZON_RECHAZOS =
  "Mercado Pago informa rechazos y cancelaciones, pero el webhook los guarda a los dos como FAILED: están incluidos en payments_failed y no se pueden separar.";

export type Ventas = {
  purchases_count: number;
  purchases_gross: { currency: string; amount: number | null; suppressed: boolean }[];
  payments_failed: number;
  payments_rejected: null;
  failure_rate: number | null;
  gifts_count: number;
  unavailable_reason: { payments_rejected: string; purchases_gross?: string };
};

/** Una moneda sólo se acepta si parece un código ISO: tres letras. */
const MONEDA = /^[A-Z]{3}$/;

export async function ventas(q: Consulta, p: Periodo, grupoMinimo: number): Promise<Ventas> {
  const filas = await q<Fila>(SQL_VENTAS, [aTimestamp(p.desde), aTimestamp(p.hasta)]);

  let pagadas = 0;
  let fallidas = 0;
  let regalos = 0;
  let algunaSuprimida = false;
  const bruto: Ventas["purchases_gross"] = [];

  for (const f of filas) {
    pagadas += f.pagadas;
    fallidas += f.fallidas;
    regalos += f.regalos;
    if (f.pagadas === 0) continue;
    const monto = montoProtegido(f.pagadas, Number(f.bruto_centavos), grupoMinimo);
    if (monto === null) algunaSuprimida = true;
    bruto.push({
      currency: MONEDA.test(f.moneda) ? f.moneda : "XXX",
      amount: monto,
      suppressed: monto === null,
    });
  }
  bruto.sort((a, b) => a.currency.localeCompare(b.currency));

  return {
    purchases_count: pagadas,
    purchases_gross: bruto,
    payments_failed: fallidas,
    payments_rejected: null,
    failure_rate: tasa(fallidas, pagadas + fallidas),
    gifts_count: regalos,
    unavailable_reason: {
      payments_rejected: RAZON_RECHAZOS,
      ...(algunaSuprimida ? { purchases_gross: razonMontoSuprimido(grupoMinimo) } : {}),
    },
  };
}
