import type { Consulta } from "../db.js";
import { describir, type Periodo } from "../periodo.js";
import { activacion, type Activacion } from "./activacion.js";
import { salud } from "./salud.js";
import { uso, type Uso } from "./uso.js";
import { ventas, type Ventas } from "./ventas.js";

/**
 * Una semana entera, y opcionalmente la anterior para comparar.
 *
 * La salud es la de AHORA, no la de esa semana: no hay historia de salud
 * guardada, y armar una "salud de la semana pasada" sería inventarla. Por eso
 * el campo se llama `health_now`.
 */

type Cambio = { current: number; previous: number; change: number; change_pct: number | null };

function cambio(actual: number, previo: number): Cambio {
  return {
    current: actual,
    previous: previo,
    change: actual - previo,
    change_pct: previo === 0 ? null : Math.round(((actual - previo) / previo) * 10_000) / 10_000,
  };
}

type Bloque = { activation: Activacion; usage: Uso; sales: Ventas };

async function bloque(q: Consulta, p: Periodo, grupoMinimo: number): Promise<Bloque> {
  // Una atrás de la otra: van por la misma conexión y la misma transacción,
  // en paralelo se encolarían igual.
  const activation = await activacion(q, p);
  const usage = await uso(q, p);
  const sales = await ventas(q, p, grupoMinimo);
  return { activation, usage, sales };
}

export async function semana(
  q: Consulta,
  p: Periodo,
  anterior: Periodo | null,
  grupoMinimo: number,
  ahora: Date,
) {
  const actual = await bloque(q, p, grupoMinimo);
  const s = await salud(q, ahora);
  const health_now = {
    status: s.status,
    photo_processing: s.photo_processing.status,
    payments: s.payments.status,
    alerts_count: s.alerts.length,
  };

  if (!anterior) {
    return { week: describir(p), ...actual, health_now };
  }

  const previo = await bloque(q, anterior, grupoMinimo);
  const deltas = {
    photographers_registered: cambio(actual.activation.photographers_registered, previo.activation.photographers_registered),
    photographers_with_event: cambio(actual.activation.photographers_with_event, previo.activation.photographers_with_event),
    photographers_with_photos: cambio(actual.activation.photographers_with_photos, previo.activation.photographers_with_photos),
    events_created: cambio(actual.usage.events_created, previo.usage.events_created),
    photos_uploaded: cambio(actual.usage.photos_uploaded, previo.usage.photos_uploaded),
    face_searches: cambio(actual.usage.face_searches, previo.usage.face_searches),
    purchases_count: cambio(actual.sales.purchases_count, previo.sales.purchases_count),
    payments_failed: cambio(actual.sales.payments_failed, previo.sales.payments_failed),
    gifts_count: cambio(actual.sales.gifts_count, previo.sales.gifts_count),
  };

  return {
    week: describir(p),
    ...actual,
    health_now,
    previous_week: { week: describir(anterior), ...previo },
    deltas,
  };
}
