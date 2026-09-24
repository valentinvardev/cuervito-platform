import { ErrorHerramienta } from "./errores.js";

/**
 * Los períodos, en días calendario de la zona del negocio.
 *
 * "Hoy" es hoy en Buenos Aires, no en UTC. A las 22 hs de Argentina ya es
 * mañana en UTC, y un "hoy" en UTC mostraría la noche anterior mezclada con
 * la mañana de hoy. Por eso cada período se arma con días locales y después
 * se convierte a los instantes UTC que guarda la base.
 *
 * Todos los rangos son [desde, hasta): el día final entero adentro, y el
 * primer instante del día siguiente afuera.
 */

export type Fecha = { y: number; m: number; d: number };

export type EtiquetaPeriodo = "today" | "last_7d" | "last_30d" | "custom" | "week" | "month";

export type Periodo = {
  etiqueta: EtiquetaPeriodo;
  /** Primer y último día, inclusive, en la zona del negocio. */
  primerDia: Fecha;
  ultimoDia: Fecha;
  /** Los mismos límites como instantes UTC: [desde, hasta). */
  desde: Date;
  hasta: Date;
  zona: string;
};

const MAX_DIAS_CUSTOM = 366;

// ── Fechas ──────────────────────────────────────────────────────────────────

function partes(instante: Date, zona: string) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: zona,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p: Record<string, number> = {};
  for (const x of f.formatToParts(instante)) if (x.type !== "literal") p[x.type] = Number(x.value);
  return p as { year: number; month: number; day: number; hour: number; minute: number; second: number };
}

/** Cuántos minutos está la zona por delante de UTC en ese instante (ART: -180). */
function desfaseMin(instante: Date, zona: string): number {
  const p = partes(instante, zona);
  const comoUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const segundo = Math.floor(instante.getTime() / 1000) * 1000;
  return Math.round((comoUTC - segundo) / 60_000);
}

/** El instante UTC en que empieza ese día en esa zona. */
export function medianocheUTC(f: Fecha, zona: string): Date {
  const base = Date.UTC(f.y, f.m - 1, f.d);
  let t = base - desfaseMin(new Date(base), zona) * 60_000;
  // Segunda pasada por si el primer desfase cayó del otro lado de un cambio
  // de horario. Argentina no tiene, pero la zona es configurable.
  t = base - desfaseMin(new Date(t), zona) * 60_000;
  return new Date(t);
}

export function hoyEn(zona: string, ahora: Date = new Date()): Fecha {
  const p = partes(ahora, zona);
  return { y: p.year, m: p.month, d: p.day };
}

export function sumarDias(f: Fecha, n: number): Fecha {
  const t = new Date(Date.UTC(f.y, f.m - 1, f.d + n));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

export function compararFechas(a: Fecha, b: Fecha): number {
  return Date.UTC(a.y, a.m - 1, a.d) - Date.UTC(b.y, b.m - 1, b.d);
}

export function diasEntre(a: Fecha, b: Fecha): number {
  return Math.round(compararFechas(b, a) / 86_400_000);
}

/** 0 domingo … 1 lunes … 6 sábado. El día de la semana de una fecha no depende de la zona. */
export function diaSemana(f: Fecha): number {
  return new Date(Date.UTC(f.y, f.m - 1, f.d)).getUTCDay();
}

export function fechaISO(f: Fecha): string {
  return `${String(f.y).padStart(4, "0")}-${String(f.m).padStart(2, "0")}-${String(f.d).padStart(2, "0")}`;
}

/** YYYY-MM-DD, y que exista: 2026-02-30 no pasa. */
export function parsearFecha(s: string): Fecha | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const f = { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
  const t = new Date(Date.UTC(f.y, f.m - 1, f.d));
  if (t.getUTCFullYear() !== f.y || t.getUTCMonth() + 1 !== f.m || t.getUTCDate() !== f.d) return null;
  return f;
}

/** Un instante UTC como literal de `timestamp` sin zona, que es como guarda Prisma. */
export function aTimestamp(d: Date): string {
  return d.toISOString().slice(0, 23);
}

// ── Períodos ────────────────────────────────────────────────────────────────

function armar(etiqueta: EtiquetaPeriodo, primerDia: Fecha, ultimoDia: Fecha, zona: string): Periodo {
  return {
    etiqueta,
    primerDia,
    ultimoDia,
    desde: medianocheUTC(primerDia, zona),
    hasta: medianocheUTC(sumarDias(ultimoDia, 1), zona),
    zona,
  };
}

export type EntradaPeriodo = {
  period?: string;
  from?: string;
  to?: string;
};

export function resolverPeriodo(entrada: EntradaPeriodo, zona: string, ahora: Date = new Date()): Periodo {
  const hoy = hoyEn(zona, ahora);
  const tipo = entrada.period ?? "last_7d";

  switch (tipo) {
    case "today":
      return armar("today", hoy, hoy, zona);
    case "last_7d":
      // Siete días calendario contando hoy: hoy y los seis anteriores.
      return armar("last_7d", sumarDias(hoy, -6), hoy, zona);
    case "last_30d":
      return armar("last_30d", sumarDias(hoy, -29), hoy, zona);
    case "custom": {
      if (!entrada.from || !entrada.to) {
        throw new ErrorHerramienta("invalid_period", "Con period=custom hacen falta from y to (YYYY-MM-DD).");
      }
      const desde = parsearFecha(entrada.from);
      const hasta = parsearFecha(entrada.to);
      if (!desde || !hasta) {
        throw new ErrorHerramienta("invalid_period", "from y to tienen que ser fechas válidas en formato YYYY-MM-DD.");
      }
      if (compararFechas(desde, hasta) > 0) {
        throw new ErrorHerramienta("invalid_period", "from no puede ser posterior a to.");
      }
      if (diasEntre(desde, hasta) + 1 > MAX_DIAS_CUSTOM) {
        throw new ErrorHerramienta("invalid_period", `El período puede tener hasta ${MAX_DIAS_CUSTOM} días.`);
      }
      if (compararFechas(desde, hoy) > 0) {
        throw new ErrorHerramienta("invalid_period", "El período empieza en el futuro.");
      }
      return armar("custom", desde, hasta, zona);
    }
    default:
      throw new ErrorHerramienta("invalid_period", "period tiene que ser today, last_7d, last_30d o custom.");
  }
}

/**
 * Una semana de lunes a domingo. Sin `weekStart`, la última semana completa:
 * la de un snapshot semanal es la que ya terminó, no la que va por la mitad.
 */
export function resolverSemana(weekStart: string | undefined, zona: string, ahora: Date = new Date()): Periodo {
  const hoy = hoyEn(zona, ahora);
  const lunesDeEstaSemana = sumarDias(hoy, -((diaSemana(hoy) + 6) % 7));

  let lunes: Fecha;
  if (weekStart) {
    const f = parsearFecha(weekStart);
    if (!f) throw new ErrorHerramienta("invalid_period", "week_start tiene que ser una fecha válida en formato YYYY-MM-DD.");
    if (diaSemana(f) !== 1) throw new ErrorHerramienta("invalid_period", "week_start tiene que ser un lunes.");
    if (compararFechas(f, lunesDeEstaSemana) > 0) {
      throw new ErrorHerramienta("invalid_period", "week_start es una semana futura.");
    }
    lunes = f;
  } else {
    lunes = sumarDias(lunesDeEstaSemana, -7);
  }
  return armar("week", lunes, sumarDias(lunes, 6), zona);
}

export function semanaAnterior(p: Periodo): Periodo {
  return armar("week", sumarDias(p.primerDia, -7), sumarDias(p.primerDia, -1), p.zona);
}

export function describir(p: Periodo) {
  return {
    label: p.etiqueta,
    from: fechaISO(p.primerDia),
    to: fechaISO(p.ultimoDia),
    timezone: p.zona,
  };
}

// ── Meses de facturación ────────────────────────────────────────────────────

export type Mes = Periodo & {
  /** Hasta dónde hay datos: ahora si es el mes en curso, el fin del mes si ya pasó. */
  hastaMedido: Date;
  esActual: boolean;
};

const MESES_ATRAS_MAX = 24;

/**
 * Un mes calendario en UTC, que es como factura AWS y como cuenta la base
 * los llamados a Rekognition (RecognitionUsage guarda año y mes en UTC). No
 * se usa la zona del negocio: un mes de Buenos Aires empieza tres horas
 * después que el de AWS, y los dos números no se podrían comparar.
 */
export function resolverMes(mes: string | undefined, ahora: Date = new Date()): Mes {
  const actualY = ahora.getUTCFullYear();
  const actualM = ahora.getUTCMonth() + 1;
  let y = actualY;
  let m = actualM;
  if (mes) {
    const r = /^(\d{4})-(\d{2})$/.exec(mes);
    if (!r || Number(r[2]) < 1 || Number(r[2]) > 12) {
      throw new ErrorHerramienta("invalid_period", "month tiene que ser YYYY-MM, por ejemplo 2026-09.");
    }
    y = Number(r[1]);
    m = Number(r[2]);
    const diferencia = (actualY - y) * 12 + (actualM - m);
    if (diferencia < 0) throw new ErrorHerramienta("invalid_period", "El mes pedido todavía no empezó.");
    if (diferencia > MESES_ATRAS_MAX) {
      throw new ErrorHerramienta("invalid_period", `Se pueden pedir hasta ${MESES_ATRAS_MAX} meses para atrás.`);
    }
  }
  const primerDia: Fecha = { y, m, d: 1 };
  const siguiente = new Date(Date.UTC(y, m, 1));
  const ultimoDia = sumarDias({ y: siguiente.getUTCFullYear(), m: siguiente.getUTCMonth() + 1, d: 1 }, -1);
  const desde = new Date(Date.UTC(y, m - 1, 1));
  const esActual = y === actualY && m === actualM;
  return {
    etiqueta: "month",
    primerDia,
    ultimoDia,
    desde,
    hasta: siguiente,
    zona: "UTC",
    hastaMedido: esActual ? ahora : siguiente,
    esActual,
  };
}
