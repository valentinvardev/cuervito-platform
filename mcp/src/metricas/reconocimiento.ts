import { tasa } from "../privacidad.js";
import { AHORA, COLGADA, HORAS_ETAPA_LENTA, INTENTOS_RAPIDOS, MAX_INTENTOS } from "./cola.js";
import { peor, type Alerta, type Estado } from "./estado.js";

/**
 * El reconocimiento: si las fotos que ya se ven también se pueden encontrar.
 *
 * Una foto con vista previa está en la tienda y se vende, pero si le faltan
 * las caras nadie la encuentra con una selfie, y si le falta el OCR nadie la
 * encuentra por dorsal. Para el que la busca es lo mismo que no estar. Hasta
 * septiembre de 2026 esto no se miraba: la salud contaba sólo las vistas
 * previas, y un centenar de fotos quedaron sin reconocer durante días sin que
 * nada avisara.
 *
 * Lo que se cuenta son las fotos VISIBLES (con archivo y vista previa, sin
 * borrar) de eventos con el reconocimiento prendido a las que les falta alguna
 * de las dos cosas. Cada una cae en exactamente un grupo, según lo que la cola
 * anotó en sus columnas, y los grupos suman `missing`:
 *
 *   parked_after_retries  la cola se rindió (MAX_INTENTOS intentos)
 *   waiting_quota         el fotógrafo llegó al tope del mes; espera al que viene
 *   retrying              falló y espera su próximo intento
 *   in_flight             la cola la está procesando ahora
 *   queued                libre, esperando que la cola la tome
 *
 * Las columnas de reconocimiento se ponen al RECLAMAR, un instante antes de
 * llamar a Rekognition, y se vuelven a null si la llamada falla. Así que la
 * más reciente es un buen reloj de cuándo trabajó por última vez el
 * reconocimiento con éxito o a punto de tenerlo.
 */

// ── Consultas ───────────────────────────────────────────────────────────────

export const SQL_RECONOCIMIENTO = `
with visibles as (
  select
    p."processAttempts" >= ${MAX_INTENTOS} as apartada,
    coalesce(p."processLeaseUntil" > ${AHORA}, false) as tomada,
    -- Sin prefijo: Event no tiene columnas process*, así que no hay ambigüedad.
    ${COLGADA} as colgada,
    p."processError" as error,
    -- Desde cuándo la cola la podría haber tomado: cuando terminó la vista
    -- previa, o cuando venció la espera de su último fallo.
    greatest(p."processLeaseUntil", coalesce(p."previewGeneratedAt", p."createdAt")) as libre_desde,
    p."processAttempts" >= ${INTENTOS_RAPIDOS} as lenta,
    e.recognition as prendido,
    (p."faceProcessedAt" is null or (e."bibDetection" and p."ocrProcessedAt" is null)) as falta,
    greatest(p."faceProcessedAt", p."ocrProcessedAt") > ${AHORA} - interval '7 days' as reciente,
    p."eventId" as evento,
    case when p."faceProcessedAt" > ${AHORA} - interval '7 days'
      then exists (select 1 from "FaceRecord" f where f."photoId" = p.id)
    end as con_caras_7d
  from "Photo" p
  join "Event" e on e.id = p."eventId"
  where p."deletedAt" is null and p."fileSize" is not null and p."previewKey" is not null
), clasificadas as (
  select lenta, colgada, libre_desde, prendido, error, reciente, evento, con_caras_7d,
    case
      when not (prendido and falta) then null
      when apartada then 'apartada'
      when tomada and error like 'cuota:%' then 'cuota'
      when tomada and error is not null then 'reintentando'
      when tomada then 'en_vuelo'
      else 'en_cola'
    end as grupo
  from visibles
)
select
  count(*) filter (where grupo is not null)::int as faltan,
  count(*) filter (where grupo = 'apartada')::int as apartadas,
  count(*) filter (where grupo = 'cuota')::int as esperando_cuota,
  count(*) filter (where grupo = 'reintentando')::int as reintentando,
  count(*) filter (where grupo = 'reintentando' and lenta)::int as reintentando_despacio,
  count(*) filter (where grupo = 'en_vuelo')::int as en_vuelo,
  count(*) filter (where grupo = 'en_vuelo' and colgada)::int as colgadas,
  count(*) filter (where grupo = 'en_cola')::int as en_cola,
  count(*) filter (where grupo = 'en_cola' and libre_desde < ${AHORA} - interval '15 minutes')::int as en_cola_15m,
  count(*) filter (where grupo = 'en_cola' and libre_desde < ${AHORA} - interval '3 hours')::int as en_cola_3h,
  count(*) filter (where prendido and error like 'rekperm:%')::int as rechazadas,
  count(*) filter (where prendido and error like 'rekperm:%' and reciente)::int as rechazadas_7d,
  count(*) filter (where not prendido)::int as apagado_fotos,
  count(distinct evento) filter (where not prendido)::int as apagado_eventos,
  count(*) filter (where prendido and con_caras_7d is not null)::int as reconocidas_7d,
  count(*) filter (where prendido and con_caras_7d = false)::int as sin_caras_7d,
  (select extract(epoch from (${AHORA} - greatest(max("faceProcessedAt"), max("ocrProcessedAt"))))::int
     from "Photo") as edad_ultimo_s
from clasificadas
`;

/** Los errores de las que siguen sin reconocer, por clase (el prefijo; el resto no se lee). */
export const SQL_ERRORES_RECONOCIMIENTO = `
select split_part(p."processError", ':', 1) as clase, count(*)::int as n
from "Photo" p
join "Event" e on e.id = p."eventId"
where p."deletedAt" is null and p."fileSize" is not null and p."previewKey" is not null
  and e.recognition
  and (p."faceProcessedAt" is null or (e."bibDetection" and p."ocrProcessedAt" is null))
  and p."processError" is not null
group by 1
`;

/**
 * El freno de la cola: cuando fallan muchas llamadas seguidas a Rekognition,
 * la app deja de tomar reconocimientos un rato y lo anota acá (ver FRENO_FALLOS
 * en cola-fotos.ts). Una fila de configuración, leída por su clave.
 */
export const SQL_FRENO_RECONOCIMIENTO = `select value from "Setting" where key = 'procesador:freno-reconocimiento'`;

/**
 * Diez minutos después de que vence el freno. La cola ociosa duerme hasta ese
 * tiempo entre vueltas; la app se despierta sola al vencer, pero si justo
 * reinició, lo primero que la saca es el cron. Mientras tanto hay fotos
 * esperando y nada reconocido hace rato, que no es un atasco.
 */
const GRACIA_FRENO_MS = 10 * 60_000;

export type Freno = { hasta: string; vigente: boolean };

/**
 * El freno anotado, si está puesto o venció hace menos de GRACIA_FRENO_MS; si
 * no, null. La app lo borra al arrancar (con una fecha de ahora), así que uno
 * viejo no queda dando vueltas.
 */
export function leerFreno(valor: string | undefined, ahora: Date): Freno | null {
  if (!valor) return null;
  try {
    const v = JSON.parse(valor) as { hasta?: unknown };
    if (typeof v.hasta !== "string") return null;
    const t = Date.parse(v.hasta);
    if (!Number.isFinite(t) || t + GRACIA_FRENO_MS <= ahora.getTime()) return null;
    return { hasta: new Date(t).toISOString(), vigente: t > ahora.getTime() };
  } catch {
    return null;
  }
}

// ── Umbrales ────────────────────────────────────────────────────────────────

/**
 * Sin reconocer nada en media hora con fotos que llevan un cuarto de hora
 * libres: la cola no está tomando trabajo. El cuarto de hora es porque la cola
 * ociosa duerme hasta diez minutos entre vueltas; una foto cuyo reintento
 * venció recién no es un atasco, es una cola que todavía no se despertó.
 */
const SIN_RECONOCER_DOWN_S = 30 * 60;
/** Tantas fallando a la vez y ninguna reconocida en media hora: no es una foto rara, es el reconocimiento. */
const FALLANDO_A_LA_VEZ = 10;
/** Cuántas fotos reconocidas hacen falta para que una proporción diga algo. */
const MUESTRA_SIN_CARAS = 100;
/**
 * Lo normal es que entre un 5 y un 13 % de las fotos de una semana no tenga
 * ninguna cara detectable (de espaldas, lejos, con casco), y ningún evento
 * pasó del 22 %. Más del 30 % en una semana ya no es el deporte: es que a
 * Rekognition le están llegando mal las imágenes.
 */
const SIN_CARAS_MAXIMO = 0.3;

// ── Estado ──────────────────────────────────────────────────────────────────

export type FilaReconocimiento = {
  faltan: number;
  apartadas: number;
  esperando_cuota: number;
  reintentando: number;
  reintentando_despacio: number;
  en_vuelo: number;
  colgadas: number;
  en_cola: number;
  en_cola_15m: number;
  en_cola_3h: number;
  rechazadas: number;
  rechazadas_7d: number;
  apagado_fotos: number;
  apagado_eventos: number;
  reconocidas_7d: number;
  sin_caras_7d: number;
  edad_ultimo_s: number | null;
};

export const FILA_VACIA: FilaReconocimiento = {
  faltan: 0, apartadas: 0, esperando_cuota: 0, reintentando: 0, reintentando_despacio: 0,
  en_vuelo: 0, colgadas: 0, en_cola: 0, en_cola_15m: 0, en_cola_3h: 0, rechazadas: 0,
  rechazadas_7d: 0, apagado_fotos: 0, apagado_eventos: 0, reconocidas_7d: 0, sin_caras_7d: 0,
  edad_ultimo_s: null,
};

export type Reconocimiento = {
  status: Estado;
  missing: number;
  queued: number;
  queued_over_3h: number;
  in_flight: number;
  retrying: number;
  retrying_slowly: number;
  waiting_quota: number;
  parked_after_retries: number;
  rejected_by_rekognition: number;
  paused_until: string | null;
  last_recognition_age_s: number | null;
  recognized_last_7d: number;
  without_faces_last_7d: number;
  no_faces_share_last_7d: number | null;
  recognition_off_events: number;
  recognition_off_photos: number;
};

export type Contexto = {
  /**
   * Si hay vistas previas para hacer. La cola las hace primero y al
   * reconocimiento le da sólo los lugares que sobran, así que con vistas
   * previas pendientes que el reconocimiento espere es lo normal: eso lo juzga
   * la parte de photo_processing.
   */
  hayPreviewsEsperando: boolean;
  /** El freno de la cola, si está puesto o venció recién. */
  freno: Freno | null;
};

export function evaluarReconocimiento(
  f: FilaReconocimiento,
  ctx: Contexto,
): { reconocimiento: Reconocimiento; alertas: Alerta[] } {
  const alertas: Alerta[] = [];
  let estado: Estado = "ok";
  const edad = f.edad_ultimo_s;
  const sinReconocerHaceRato = edad === null || edad > SIN_RECONOCER_DOWN_S;
  const minutos = edad === null ? null : Math.round(edad / 60);
  // Con el freno puesto, o recién vencido, que no se reconozca es lo esperado:
  // eso lo dice recognition_paused, no un atasco.
  const puedeTrabajar = !ctx.hayPreviewsEsperando && !ctx.freno;
  const fallandoRecien = f.reintentando - f.reintentando_despacio;

  if (ctx.freno?.vigente) {
    estado = "down";
    alertas.push({
      severity: "critical",
      code: "recognition_paused",
      message:
        `Rekognition falló muchas veces seguidas y la cola pausó el reconocimiento hasta ${ctx.freno.hasta} (UTC). ` +
        "No es una foto: suele ser un problema de credenciales, de permisos o de AWS. " +
        `Mientras tanto hay ${f.faltan} fotos que no se encuentran por selfie ni por dorsal.`,
    });
  }

  const esperando = f.en_cola_15m + f.colgadas;
  if (puedeTrabajar && esperando > 0 && sinReconocerHaceRato) {
    estado = "down";
    alertas.push({
      severity: "critical",
      code: "recognition_stalled",
      message:
        `El reconocimiento no avanza: ${esperando} fotos esperan hace más de 15 min` +
        (minutos === null ? " y nunca se reconoció ninguna." : ` y la última se reconoció hace ${minutos} min.`) +
        " Se ven en la tienda pero nadie las encuentra por selfie ni por dorsal.",
    });
  }

  // Sólo las de la etapa rápida: fallaron hace menos de cinco minutos. Las
  // lentas pueden llevar horas esperando con la causa ya arreglada; ésas son
  // recognition_retrying, no una caída.
  if (puedeTrabajar && fallandoRecien >= FALLANDO_A_LA_VEZ && sinReconocerHaceRato) {
    estado = "down";
    alertas.push({
      severity: "critical",
      code: "recognition_failing",
      message:
        `El reconocimiento está fallando: ${fallandoRecien} fotos fallaron recién y esperan reintento` +
        (minutos === null ? ", y nunca se reconoció ninguna." : `, y ninguna se reconoció en los últimos ${minutos} min.`),
    });
  }
  if (f.reintentando_despacio > 0) {
    estado = peor(estado, "degraded");
    alertas.push({
      severity: "warning",
      code: "recognition_retrying",
      message:
        `${f.reintentando_despacio} fotos fallaron el reconocimiento ${INTENTOS_RAPIDOS} veces seguidas y la cola las reintenta ` +
        `cada vez más espaciado, durante unos ${Math.round(HORAS_ETAPA_LENTA / 24)} días. Mientras tanto no se encuentran por selfie ni por dorsal.`,
    });
  }

  if (f.apartadas > 0) {
    estado = peor(estado, "degraded");
    alertas.push({
      severity: "warning",
      code: "recognition_parked",
      message:
        `${f.apartadas} fotos se ven pero no se encuentran por selfie ni por dorsal: la cola las intentó ${MAX_INTENTOS} veces ` +
        `en unos ${Math.round(HORAS_ETAPA_LENTA / 24)} días y se rindió. Hay que ver por qué fallan y reintentarlas a mano.`,
    });
  }

  if (f.rechazadas_7d > 0) {
    estado = peor(estado, "degraded");
    alertas.push({
      severity: "warning",
      code: "recognition_rejected",
      message:
        `Rekognition rechazó ${f.rechazadas_7d} fotos en los últimos 7 días (formato o tamaño que no acepta). ` +
        "No se reintentan solas: esas fotos no se encuentran por selfie ni por dorsal.",
    });
  }

  /* El tope que corta es el cortacircuitos de costo de la app
     (RECOGNITION_HARD_CAP_MONTHLY, en cinco veces el pico real), no la cuota
     comercial del panel. Llegar ahí es una anomalía —un loop, un abuso, un
     reintento que se fue de mano— y deja al fotógrafo sin reconocimiento hasta
     fin de mes: se mira hoy. */
  if (f.esperando_cuota > 0) {
    estado = peor(estado, "degraded");
    alertas.push({
      severity: "warning",
      code: "recognition_waiting_quota",
      message:
        `${f.esperando_cuota} fotos esperan al mes que viene porque su fotógrafo llegó al tope de gasto de reconocimiento ` +
        "(RECOGNITION_HARD_CAP_MONTHLY, el cortacircuitos de costo, no la cuota del panel). Hay que ver por qué llegó: " +
        "si fue legítimo, se sube el tope y se reintentan con la clase 'cuota'.",
    });
  }

  const share = tasa(f.sin_caras_7d, f.reconocidas_7d);
  if (f.reconocidas_7d >= MUESTRA_SIN_CARAS && share !== null && share > SIN_CARAS_MAXIMO) {
    estado = peor(estado, "degraded");
    alertas.push({
      severity: "warning",
      code: "recognition_no_faces",
      message:
        `En los últimos 7 días el ${Math.round(share * 100)} % de las fotos reconocidas no tiene ninguna cara ` +
        "(lo normal es menos del 15 %). Puede que a Rekognition le estén llegando mal las imágenes.",
    });
  }

  return {
    reconocimiento: {
      status: estado,
      missing: f.faltan,
      queued: f.en_cola,
      queued_over_3h: f.en_cola_3h,
      in_flight: f.en_vuelo,
      retrying: f.reintentando,
      retrying_slowly: f.reintentando_despacio,
      waiting_quota: f.esperando_cuota,
      parked_after_retries: f.apartadas,
      rejected_by_rekognition: f.rechazadas,
      paused_until: ctx.freno?.vigente ? ctx.freno.hasta : null,
      last_recognition_age_s: edad,
      recognized_last_7d: f.reconocidas_7d,
      without_faces_last_7d: f.sin_caras_7d,
      no_faces_share_last_7d: share,
      recognition_off_events: f.apagado_eventos,
      recognition_off_photos: f.apagado_fotos,
    },
    alertas,
  };
}
