import type { Consulta } from "../db.js";
import { tasa } from "../privacidad.js";

/**
 * La salud de ahora mismo: el procesador de fotos y los pagos.
 *
 * Todo sale de la base, porque es ahí donde vive el estado. El procesador no
 * corre en Lambda sino en una cola adentro del servidor de la aplicación, y
 * esa cola guarda su estado en las columnas de cada foto: `previewKey` nulo
 * es "todavía no se ve en la tienda", `processError` es por qué falló,
 * `processAttempts` cuántas veces se intentó. Contar esas columnas dice más
 * que cualquier métrica de infraestructura.
 *
 * Los umbrales están escritos para que "down" signifique "hay que hacer algo
 * ya" y "degraded" "hay que mirarlo hoy". Un sistema de alertas que grita por
 * todo se deja de leer.
 */

// ── Consultas ───────────────────────────────────────────────────────────────

/** Una foto pendiente: subida, sin borrar, y todavía sin vista previa con marca. */
const PENDIENTE = `"fileSize" is not null and "previewKey" is null and "deletedAt" is null`;
/**
 * Pendiente y que la cola todavía va a tomar. Las que llegaron a 4 intentos
 * quedan apartadas a propósito: la cola deja de intentarlas y alguien las
 * tiene que devolver a mano. Distinguirlas importa para el estado: diez fotos
 * apartadas con la cola ociosa no es "el procesador se cayó", es "hay diez
 * fotos para reintentar".
 */
const TRABAJABLE = `${PENDIENTE} and "processAttempts" < 4`;
const AHORA = `(now() at time zone 'utc')`;

export const SQL_FOTOS = `
select
  count(*) filter (where ${PENDIENTE})::int as pendientes,
  count(*) filter (where ${PENDIENTE} and "createdAt" < ${AHORA} - interval '1 hour')::int as pendientes_1h,
  count(*) filter (where ${PENDIENTE} and "processLeaseUntil" > ${AHORA} and "processError" is null)::int as en_vuelo,
  count(*) filter (where ${PENDIENTE} and "processAttempts" >= 4)::int as apartadas,
  count(*) filter (where ${TRABAJABLE})::int as trabajables,
  count(*) filter (where ${TRABAJABLE} and "createdAt" < ${AHORA} - interval '1 hour')::int as trabajables_1h,
  count(*) filter (where "previewGeneratedAt" > ${AHORA} - interval '1 hour')::int as ultima_hora,
  extract(epoch from (${AHORA} - max("previewGeneratedAt")))::int as edad_ultimo_exito_s
from "Photo"
`;

/**
 * Los errores de procesamiento VIGENTES, por clase.
 *
 * No hay una fecha de cuándo falló una foto: `processLeaseUntil` es la fecha
 * del próximo reintento en los fallos transitorios, pero queda en null en los
 * permanentes. Así que en vez de inventar una ventana de 24 horas con un dato
 * que no existe, se cuentan las fotos que HOY siguen sin vista previa y con
 * error. Es el conjunto que importa: las que no se ven en la tienda.
 *
 * Se agrupa por el prefijo del mensaje (`tope:`, `s3:`...) y el resto del
 * texto no se lee nunca: puede traer claves de S3 o fragmentos del error.
 */
export const SQL_ERRORES_FOTOS = `
select split_part("processError", ':', 1) as clase, count(*)::int as n
from "Photo"
where ${PENDIENTE} and "processError" is not null
group by 1
`;

export const SQL_PAGOS = `
select
  count(*) filter (where status = 'PAID' and coalesce("paidAt", "createdAt") > ${AHORA} - interval '24 hours')::int as pagadas,
  count(*) filter (where status = 'FAILED' and "createdAt" > ${AHORA} - interval '24 hours')::int as fallidas,
  count(*) filter (
    where status = 'PENDING'
      and "createdAt" <= ${AHORA} - interval '1 hour'
      and "createdAt" >  ${AHORA} - interval '24 hours'
  )::int as sin_confirmar,
  count(*) filter (
    where status = 'PENDING'
      and "createdAt" <= ${AHORA} - interval '24 hours'
      and "createdAt" >  ${AHORA} - interval '30 days'
  )::int as abandonadas
from "Sale"
`;

/** Los tiempos por etapa que anota el procesador (ver diagnostico.ts en la app). */
export const SQL_TIEMPOS = `select value from "Setting" where key = 'procesador:tiempos'`;

// ── Estado ──────────────────────────────────────────────────────────────────

export type Estado = "ok" | "degraded" | "down";
export type Alerta = { severity: "critical" | "warning"; code: string; message: string };

const CLASES_CONOCIDAS = new Set(["tope", "s3", "corrupta", "cuota", "rek", "error"]);

const PEOR: Record<Estado, number> = { ok: 0, degraded: 1, down: 2 };
export function peor(...estados: Estado[]): Estado {
  return estados.reduce<Estado>((a, b) => (PEOR[b] > PEOR[a] ? b : a), "ok");
}

// Umbrales. Están acá y no sueltos en el código para poder leerlos de un vistazo.
const SIN_EXITO_DOWN_S = 30 * 60; // con fotos pendientes y ninguna terminada en media hora
const SIN_EXITO_DEGRADED_S = 10 * 60;
const DESCARGA_LENTA_MS = 30_000; // una descarga normal de un original son menos de 15 s
const TIEMPOS_VIGENCIA_MS = 6 * 3600_000;
const TIEMPOS_MUESTRA_MINIMA = 3;
const PAGOS_MINIMOS = 5; // con menos intentos, una tasa no dice nada
const PAGOS_DOWN = 0.5;
const PAGOS_DEGRADED = 0.2;
const SIN_CONFIRMAR_MINIMAS = 5;

// ── Tiempos del procesador ──────────────────────────────────────────────────

type FilaTiempo = { total?: unknown; etapas?: { descarga?: unknown }; cuando?: unknown };

function percentil(ordenados: number[], p: number): number {
  const i = Math.min(ordenados.length - 1, Math.max(0, Math.ceil(p * ordenados.length) - 1));
  return ordenados[i]!;
}

export type Tiempos =
  | { samples: number; median_total_ms: number; p90_total_ms: number; median_download_ms: number | null }
  | null;

/**
 * Mediana y p90 de las últimas fotos procesadas. La fila de Setting trae el id
 * de cada foto: se lee el número y el id se tira ahí mismo, no sale de esta
 * función.
 */
export function resumirTiempos(valor: string | undefined, ahora: Date): { tiempos: Tiempos; razon?: string } {
  if (!valor) return { tiempos: null, razon: "El procesador todavía no anotó tiempos." };
  let filas: FilaTiempo[];
  try {
    const crudo: unknown = JSON.parse(valor);
    filas = Array.isArray(crudo) ? (crudo as FilaTiempo[]) : [];
  } catch {
    return { tiempos: null, razon: "Los tiempos anotados no se pudieron leer." };
  }

  const limite = ahora.getTime() - TIEMPOS_VIGENCIA_MS;
  const vigentes = filas.filter((f) => {
    const t = typeof f.cuando === "string" ? Date.parse(f.cuando) : NaN;
    return Number.isFinite(t) && t >= limite && typeof f.total === "number" && Number.isFinite(f.total);
  });
  if (vigentes.length < TIEMPOS_MUESTRA_MINIMA) {
    return { tiempos: null, razon: "Hay muy pocas fotos procesadas en las últimas 6 horas para sacar tiempos." };
  }

  const totales = vigentes.map((f) => f.total as number).sort((a, b) => a - b);
  const descargas = vigentes
    .map((f) => f.etapas?.descarga)
    .filter((d): d is number => typeof d === "number" && Number.isFinite(d))
    .sort((a, b) => a - b);

  return {
    tiempos: {
      samples: vigentes.length,
      median_total_ms: Math.round(percentil(totales, 0.5)),
      p90_total_ms: Math.round(percentil(totales, 0.9)),
      median_download_ms: descargas.length ? Math.round(percentil(descargas, 0.5)) : null,
    },
  };
}

// ── La salud completa ───────────────────────────────────────────────────────

type FilaFotos = {
  pendientes: number;
  pendientes_1h: number;
  en_vuelo: number;
  apartadas: number;
  trabajables: number;
  trabajables_1h: number;
  ultima_hora: number;
  edad_ultimo_exito_s: number | null;
};
type FilaPagos = { pagadas: number; fallidas: number; sin_confirmar: number; abandonadas: number };

export type Salud = {
  status: Estado;
  photo_processing: {
    status: Estado;
    pending: number;
    pending_over_1h: number;
    in_flight: number;
    parked_after_retries: number;
    processed_last_hour: number;
    last_success_age_s: number | null;
    timings: Tiempos;
  };
  payments: {
    status: Estado;
    window_hours: number;
    paid: number;
    failed: number;
    failure_rate: number | null;
    pending_unconfirmed: number;
    abandoned_checkouts: number;
  };
  errors: { source: string; code: string; count: number }[];
  alerts: Alerta[];
  unavailable_reason?: { timings?: string };
};

export async function salud(q: Consulta, ahora: Date = new Date()): Promise<Salud> {
  const [fotos] = await q<FilaFotos>(SQL_FOTOS);
  const errFotos = await q<{ clase: string; n: number }>(SQL_ERRORES_FOTOS);
  const [pagos] = await q<FilaPagos>(SQL_PAGOS);
  const [filaTiempos] = await q<{ value: string }>(SQL_TIEMPOS);

  const f: FilaFotos = fotos ?? {
    pendientes: 0, pendientes_1h: 0, en_vuelo: 0, apartadas: 0,
    trabajables: 0, trabajables_1h: 0, ultima_hora: 0, edad_ultimo_exito_s: null,
  };
  const g: FilaPagos = pagos ?? { pagadas: 0, fallidas: 0, sin_confirmar: 0, abandonadas: 0 };
  const { tiempos, razon: razonTiempos } = resumirTiempos(filaTiempos?.value, ahora);
  const alertas: Alerta[] = [];

  // ── Procesamiento de fotos ──
  // El atasco se mide sobre las TRABAJABLES: si la única pendiente es una
  // apartada, la cola no la va a tomar nunca y "hace tres días que no termina
  // nada" es lo esperable, no una caída. Las apartadas tienen su propia alerta.
  let estadoFotos: Estado = "ok";
  const edad = f.edad_ultimo_exito_s;
  if (f.trabajables > 0) {
    if (edad === null || edad > SIN_EXITO_DOWN_S) {
      estadoFotos = "down";
      alertas.push({
        severity: "critical",
        code: "processing_stalled",
        message:
          edad === null
            ? `Hay ${f.trabajables} fotos esperando y el procesador nunca completó ninguna.`
            : `El procesador no completa fotos hace ${Math.round(edad / 60)} min y hay ${f.trabajables} esperando. Esas fotos no se ven en las tiendas.`,
      });
    } else if (edad > SIN_EXITO_DEGRADED_S) {
      estadoFotos = peor(estadoFotos, "degraded");
    }
  }
  if (f.trabajables_1h > 0) {
    estadoFotos = peor(estadoFotos, "degraded");
    alertas.push({
      severity: "warning",
      code: "photos_not_visible",
      message: `${f.trabajables_1h} fotos llevan más de una hora sin vista previa y no aparecen en las tiendas.`,
    });
  }
  if (f.apartadas > 0) {
    estadoFotos = peor(estadoFotos, "degraded");
    alertas.push({
      severity: "warning",
      code: "photos_parked",
      message: `${f.apartadas} fotos quedaron apartadas después de 4 intentos fallidos: la cola ya no las toma y no se ven en las tiendas hasta reintentarlas a mano.`,
    });
  }
  if (tiempos?.median_download_ms != null && tiempos.median_download_ms > DESCARGA_LENTA_MS) {
    estadoFotos = peor(estadoFotos, "degraded");
    alertas.push({
      severity: "warning",
      code: "slow_storage_downloads",
      message: `Bajar un original de S3 tarda ${Math.round(tiempos.median_download_ms / 1000)} s de mediana (lo normal es menos de 15 s).`,
    });
  }

  // ── Pagos ──
  const intentos = g.pagadas + g.fallidas;
  const tasaFallos = tasa(g.fallidas, intentos);
  let estadoPagos: Estado = "ok";
  if (intentos >= PAGOS_MINIMOS && tasaFallos !== null) {
    if (tasaFallos >= PAGOS_DOWN) estadoPagos = "down";
    else if (tasaFallos >= PAGOS_DEGRADED) estadoPagos = "degraded";
    if (estadoPagos !== "ok") {
      alertas.push({
        severity: estadoPagos === "down" ? "critical" : "warning",
        code: "payment_failures",
        message: `Fallaron ${g.fallidas} de ${intentos} pagos en las últimas 24 h (${Math.round(tasaFallos * 100)} %).`,
      });
    }
  }
  // Muchas ventas sin confirmar, y más que las confirmadas: el pago salió en
  // Mercado Pago y a nosotros no nos avisaron. Con pocas es gente que abrió
  // el checkout y se fue, que pasa todos los días.
  if (g.sin_confirmar >= SIN_CONFIRMAR_MINIMAS && g.sin_confirmar > g.pagadas) {
    estadoPagos = peor(estadoPagos, "degraded");
    alertas.push({
      severity: "warning",
      code: "payments_unconfirmed",
      message: `${g.sin_confirmar} ventas de las últimas 24 h siguen sin confirmar después de una hora, más que las ${g.pagadas} confirmadas. Puede ser el webhook de Mercado Pago.`,
    });
  }

  // ── Errores ──
  const porClase = new Map<string, number>();
  for (const e of errFotos) {
    const clase = CLASES_CONOCIDAS.has(e.clase) ? e.clase : "otro";
    porClase.set(clase, (porClase.get(clase) ?? 0) + e.n);
  }
  const errores: Salud["errors"] = [...porClase].map(([code, count]) => ({ source: "photo_processing", code, count }));
  if (g.fallidas > 0) errores.push({ source: "payments", code: "payment_failed", count: g.fallidas });
  errores.sort((a, b) => b.count - a.count);

  // Lo crítico primero.
  alertas.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "critical" ? -1 : 1));

  return {
    status: peor(estadoFotos, estadoPagos),
    photo_processing: {
      status: estadoFotos,
      pending: f.pendientes,
      pending_over_1h: f.pendientes_1h,
      in_flight: f.en_vuelo,
      parked_after_retries: f.apartadas,
      processed_last_hour: f.ultima_hora,
      last_success_age_s: edad,
      timings: tiempos,
    },
    payments: {
      status: estadoPagos,
      window_hours: 24,
      paid: g.pagadas,
      failed: g.fallidas,
      failure_rate: tasaFallos,
      pending_unconfirmed: g.sin_confirmar,
      abandoned_checkouts: g.abandonadas,
    },
    errors: errores,
    alerts: alertas,
    ...(razonTiempos ? { unavailable_reason: { timings: razonTiempos } } : {}),
  };
}
