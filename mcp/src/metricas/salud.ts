import type { Consulta } from "../db.js";
import { tasa } from "../privacidad.js";
import {
  AHORA,
  COLGADA,
  HORAS_ETAPA_LENTA,
  INTENTOS_RAPIDOS,
  MAX_INTENTOS,
  REINTENTANDO_DESPACIO,
  ULTIMO_FALLO,
} from "./cola.js";
import { peor, type Alerta, type Estado } from "./estado.js";
import {
  evaluarReconocimiento,
  FILA_VACIA,
  SQL_ERRORES_RECONOCIMIENTO,
  SQL_RECONOCIMIENTO,
  leerFreno,
  SQL_FRENO_RECONOCIMIENTO,
  type FilaReconocimiento,
  type Reconocimiento,
} from "./reconocimiento.js";

export { peor, type Alerta, type Estado };

/**
 * La salud de ahora mismo: el procesador de fotos, el reconocimiento y los pagos.
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
const VIVA = `"processAttempts" < ${MAX_INTENTOS}`;
const TOMADA = `coalesce("processLeaseUntil" > ${AHORA}, false)`;

/**
 * Las vistas previas pendientes, en grupos que no se pisan: apartadas (la cola
 * se rindió), en vuelo, reintentando (fallaron y esperan) y libres (la cola
 * las puede tomar ya).
 *
 * El atasco no se mide sólo con "hace cuánto que no termina nada": en una
 * semana sin carreras eso son días, y la primera foto que se libera haría
 * decir "down" hasta que la cola se despierte —duerme hasta diez minutos
 * cuando no tiene trabajo—. Se mide con fotos que llevan más de un cuarto de
 * hora libres, o una unidad colgada, y ningún éxito en media hora: ni una
 * vista previa ni un reconocimiento. Los reclamos no cuentan como actividad:
 * en una falla como la de septiembre la cola reclama sin parar y no termina
 * nada, y contar los reclamos la hacía parecer viva.
 */
export const SQL_FOTOS = `
select
  count(*) filter (where ${PENDIENTE})::int as pendientes,
  count(*) filter (where ${PENDIENTE} and "createdAt" < ${AHORA} - interval '1 hour')::int as pendientes_1h,
  count(*) filter (where ${PENDIENTE} and ${VIVA} and ${TOMADA} and "processError" is null)::int as en_vuelo,
  count(*) filter (where ${PENDIENTE} and ${VIVA} and ${COLGADA})::int as colgadas,
  count(*) filter (where ${PENDIENTE} and not (${VIVA}))::int as apartadas,
  count(*) filter (where ${PENDIENTE} and ${VIVA} and ${TOMADA} and "processError" is not null)::int as reintentando,
  count(*) filter (where ${PENDIENTE} and ${REINTENTANDO_DESPACIO})::int as reintentando_despacio,
  count(*) filter (
    where ${PENDIENTE} and ${VIVA} and ${TOMADA} and "processError" is not null
      and ${ULTIMO_FALLO} > ${AHORA} - interval '2 hours'
  )::int as fallaron_2h,
  count(*) filter (where ${PENDIENTE} and ${VIVA} and not ${TOMADA})::int as libres,
  count(*) filter (
    where ${PENDIENTE} and ${VIVA} and not ${TOMADA}
      and greatest("processLeaseUntil", "createdAt") < ${AHORA} - interval '15 minutes'
  )::int as libres_15m,
  -- Las que no se ven hace más de una hora y no están esperando un reintento
  -- lento: ésas ya tienen su propia alerta.
  count(*) filter (
    where ${PENDIENTE} and ${VIVA} and not ${REINTENTANDO_DESPACIO}
      and "createdAt" < ${AHORA} - interval '1 hour'
  )::int as trabajables_1h,
  count(*) filter (where "previewGeneratedAt" > ${AHORA} - interval '1 hour')::int as ultima_hora,
  -- Sin las columnas del reconocimiento: si al rol le faltara ese permiso,
  -- esta consulta —la primera— se llevaría puesta toda la salud. El reloj del
  -- reconocimiento se suma después, desde su propia consulta.
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

const CLASES_CONOCIDAS = new Set(["tope", "s3", "corrupta", "cuota", "rek", "error", "reinicio", "rekperm"]);

// Umbrales. Están acá y no sueltos en el código para poder leerlos de un vistazo.
const SIN_EXITO_DOWN_S = 30 * 60; // con fotos pendientes y ninguna terminada en media hora
const SIN_EXITO_DEGRADED_S = 10 * 60;
const DESCARGA_LENTA_MS = 30_000; // una descarga normal de un original son menos de 15 s
const TIEMPOS_VIGENCIA_MS = 6 * 3600_000;
const TIEMPOS_MUESTRA_MINIMA = 3;
/** Tantas fallando a la vez y ninguna terminada en media hora: es el procesador, no una foto rara. */
const FALLANDO_A_LA_VEZ = 10;
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

/**
 * Los errores agrupados por clase. Una clase que no conocemos sale como
 * "otro": el prefijo de processError lo escribe la app, pero si un día trae
 * otra cosa, su texto no sale.
 */
function porClaseConocida(filas: { clase: string; n: number }[], source: string) {
  const porClase = new Map<string, number>();
  for (const e of filas) {
    const clase = CLASES_CONOCIDAS.has(e.clase) ? e.clase : "otro";
    porClase.set(clase, (porClase.get(clase) ?? 0) + e.n);
  }
  return [...porClase].map(([code, count]) => ({ source, code, count }));
}

/** La menor de dos edades, o la que haya: la actividad más reciente. */
function masReciente(a: number | null, b: number | null): number | null {
  if (a === null) return b;
  if (b === null) return a;
  return Math.min(a, b);
}

// ── La salud completa ───────────────────────────────────────────────────────

type FilaFotos = {
  pendientes: number;
  pendientes_1h: number;
  en_vuelo: number;
  colgadas: number;
  apartadas: number;
  reintentando: number;
  reintentando_despacio: number;
  fallaron_2h: number;
  libres: number;
  libres_15m: number;
  trabajables_1h: number;
  ultima_hora: number;
  edad_ultimo_exito_s: number | null;
};
type FilaPagos = { pagadas: number; fallidas: number; sin_confirmar: number; abandonadas: number };

const FOTOS_VACIA: FilaFotos = {
  pendientes: 0, pendientes_1h: 0, en_vuelo: 0, colgadas: 0, apartadas: 0, reintentando: 0,
  reintentando_despacio: 0, fallaron_2h: 0, libres: 0, libres_15m: 0, trabajables_1h: 0,
  ultima_hora: 0, edad_ultimo_exito_s: null,
};

export type Salud = {
  status: Estado;
  photo_processing: {
    status: Estado;
    pending: number;
    pending_over_1h: number;
    in_flight: number;
    retrying: number;
    retrying_slowly: number;
    parked_after_retries: number;
    processed_last_hour: number;
    last_success_age_s: number | null;
    timings: Tiempos;
  };
  /** null si la consulta del reconocimiento falló; la razón va en unavailable_reason. */
  recognition: Reconocimiento | null;
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
  unavailable_reason?: { timings?: string; recognition?: string };
};

type LecturaRek =
  | { ok: true; fila: FilaReconocimiento; errores: { clase: string; n: number }[]; freno: string | undefined }
  | { ok: false; razon: string };

/**
 * Las consultas del reconocimiento, aparte.
 *
 * Leen columnas que las demás no leen (Event, FaceRecord, las marcas de
 * reconocimiento de Photo), y la consulta es la más pesada. Si el rol de sólo
 * lectura no tiene alguno de esos permisos, o se pasa del tope de tiempo, su
 * falla sale como recognition: null con una alerta, sin llevarse puesta la
 * salud de las fotos y los pagos.
 *
 * Con un SAVEPOINT: en una transacción, un error la deja abortada y todo lo
 * que viniera después fallaría también —get_weekly_snapshot sigue consultando
 * la semana anterior después de la salud—. Volver al savepoint la deja usable.
 */
async function leerReconocimiento(q: Consulta): Promise<LecturaRek> {
  await q(SQL_SAVEPOINT);
  try {
    const [fila] = await q<FilaReconocimiento>(SQL_RECONOCIMIENTO);
    const errores = await q<{ clase: string; n: number }>(SQL_ERRORES_RECONOCIMIENTO);
    const [freno] = await q<{ value: string }>(SQL_FRENO_RECONOCIMIENTO);
    await q(SQL_SOLTAR_SAVEPOINT);
    return { ok: true, fila: fila ?? FILA_VACIA, errores, freno: freno?.value };
  } catch (e) {
    await q(SQL_VOLVER_AL_SAVEPOINT);
    const codigo = (e as { code?: unknown }).code;
    // Al log del servidor el código, nunca al agente el texto: el mensaje de
    // Postgres puede nombrar columnas y valores.
    console.error(`[salud] no se pudo leer el reconocimiento: ${typeof codigo === "string" ? codigo : "sin código"}`);
    return { ok: false, razon: razonSinReconocimiento(codigo) };
  }
}

export const SQL_SAVEPOINT = "savepoint reconocimiento";
export const SQL_SOLTAR_SAVEPOINT = "release savepoint reconocimiento";
export const SQL_VOLVER_AL_SAVEPOINT = "rollback to savepoint reconocimiento";

function razonSinReconocimiento(codigo: unknown): string {
  if (codigo === "42501") {
    return "No se pudo leer el reconocimiento: al rol de sólo lectura le faltan permisos (ver los del README).";
  }
  if (codigo === "57014") {
    return "No se pudo leer el reconocimiento: la consulta se pasó del tope de tiempo.";
  }
  return "No se pudo leer el reconocimiento por un error de la base.";
}

export async function salud(q: Consulta, ahora: Date = new Date()): Promise<Salud> {
  const [fotos] = await q<FilaFotos>(SQL_FOTOS);
  const errFotos = await q<{ clase: string; n: number }>(SQL_ERRORES_FOTOS);
  const [pagos] = await q<FilaPagos>(SQL_PAGOS);
  const [filaTiempos] = await q<{ value: string }>(SQL_TIEMPOS);
  const rek = await leerReconocimiento(q);

  const f: FilaFotos = fotos ?? FOTOS_VACIA;
  const g: FilaPagos = pagos ?? { pagadas: 0, fallidas: 0, sin_confirmar: 0, abandonadas: 0 };
  const { tiempos, razon: razonTiempos } = resumirTiempos(filaTiempos?.value, ahora);
  const alertas: Alerta[] = [];

  // ── Procesamiento de fotos ──
  // El atasco se mide con fotos que la cola ya tendría que haber tomado —libres
  // hace más de un cuarto de hora, o una unidad colgada— y ninguna actividad
  // de la cola en media hora. Las apartadas no cuentan: la cola no las va a
  // tomar nunca y tienen su propia alerta.
  let estadoFotos: Estado = "ok";
  const edad = f.edad_ultimo_exito_s;
  // El éxito más reciente entre las vistas previas y el reconocimiento (que
  // sale de su propia consulta): cualquiera de los dos dice que la cola anda.
  const actividad = masReciente(edad, rek.ok ? rek.fila.edad_ultimo_s : null);
  const esperando = f.libres_15m + f.colgadas;
  if (esperando > 0) {
    if (actividad === null || actividad > SIN_EXITO_DOWN_S) {
      estadoFotos = "down";
      alertas.push({
        severity: "critical",
        code: "processing_stalled",
        message:
          actividad === null
            ? `Hay ${esperando} fotos esperando y el procesador nunca completó ninguna.`
            : `El procesador no hace nada hace ${Math.round(actividad / 60)} min y hay ${esperando} fotos esperando que ya tendría que haber tomado. Esas fotos no se ven en las tiendas.`,
      });
    } else if (actividad > SIN_EXITO_DEGRADED_S) {
      estadoFotos = peor(estadoFotos, "degraded");
    }
  }
  // Muchas que fallaron en las últimas dos horas y ninguna terminada: no es
  // una foto rara, es el procesador. El atasco de arriba no las ve porque
  // están casi siempre en su espera. Las que esperan un reintento lento de
  // hace más tiempo no cuentan: puede que la causa ya esté arreglada y
  // todavía no les tocó; ésas son photos_retrying, no una caída.
  const fallandoRecien = f.fallaron_2h;
  if (fallandoRecien >= FALLANDO_A_LA_VEZ && (edad === null || edad > SIN_EXITO_DOWN_S)) {
    estadoFotos = "down";
    alertas.push({
      severity: "critical",
      code: "processing_failing",
      message:
        `El procesador está fallando: ${fallandoRecien} fotos fallaron recién y esperan reintento` +
        (edad === null ? ", y nunca terminó ninguna." : `, y ninguna terminó en los últimos ${Math.round(edad / 60)} min.`) +
        " No se ven en las tiendas.",
    });
  }
  if (f.trabajables_1h > 0) {
    estadoFotos = peor(estadoFotos, "degraded");
    alertas.push({
      severity: "warning",
      code: "photos_not_visible",
      message: `${f.trabajables_1h} fotos llevan más de una hora sin vista previa y no aparecen en las tiendas.`,
    });
  }
  if (f.reintentando_despacio > 0) {
    estadoFotos = peor(estadoFotos, "degraded");
    alertas.push({
      severity: "warning",
      code: "photos_retrying",
      message:
        `${f.reintentando_despacio} fotos siguen sin vista previa: fallaron ${INTENTOS_RAPIDOS} veces seguidas y la cola las ` +
        `reintenta cada vez más espaciado, durante unas ${HORAS_ETAPA_LENTA} horas. No se ven en las tiendas mientras tanto.`,
    });
  }
  if (f.apartadas > 0) {
    estadoFotos = peor(estadoFotos, "degraded");
    alertas.push({
      severity: "warning",
      code: "photos_parked",
      message:
        `${f.apartadas} fotos quedaron apartadas después de ${MAX_INTENTOS} intentos en unos ${Math.round(HORAS_ETAPA_LENTA / 24)} días: ` +
        "la cola ya no las toma y no se ven en las tiendas hasta reintentarlas a mano.",
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

  // ── Reconocimiento ──
  // Con vistas previas esperando, la cola le da al reconocimiento sólo los
  // lugares que sobran: que espere es lo normal.
  const evaluado = rek.ok
    ? evaluarReconocimiento(rek.fila, {
        hayPreviewsEsperando: f.libres + f.en_vuelo > 0,
        freno: leerFreno(rek.freno, ahora),
      })
    : null;
  if (evaluado) alertas.push(...evaluado.alertas);
  // Que no se pueda mirar no es "todo bien": es lo que el usuario pidió vigilar.
  const estadoRek: Estado = evaluado ? evaluado.reconocimiento.status : "degraded";
  if (!rek.ok) {
    alertas.push({ severity: "warning", code: "recognition_unavailable", message: rek.razon });
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
  const errores: Salud["errors"] = [
    ...porClaseConocida(errFotos, "photo_processing"),
    ...porClaseConocida(rek.ok ? rek.errores : [], "recognition"),
  ];
  if (g.fallidas > 0) errores.push({ source: "payments", code: "payment_failed", count: g.fallidas });
  errores.sort((a, b) => b.count - a.count);

  // Lo crítico primero.
  alertas.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "critical" ? -1 : 1));

  return {
    status: peor(estadoFotos, estadoRek, estadoPagos),
    photo_processing: {
      status: estadoFotos,
      pending: f.pendientes,
      pending_over_1h: f.pendientes_1h,
      in_flight: f.en_vuelo,
      retrying: f.reintentando,
      retrying_slowly: f.reintentando_despacio,
      parked_after_retries: f.apartadas,
      processed_last_hour: f.ultima_hora,
      last_success_age_s: edad,
      timings: tiempos,
    },
    recognition: evaluado?.reconocimiento ?? null,
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
    ...(razonTiempos || !rek.ok
      ? {
          unavailable_reason: {
            ...(razonTiempos ? { timings: razonTiempos } : {}),
            ...(!rek.ok ? { recognition: rek.razon } : {}),
          },
        }
      : {}),
  };
}
