import { peor, type Alerta, type Estado } from "./estado.js";

/**
 * La Lambda de derivados: si está haciendo las vistas previas o si las fotos
 * están cayendo al VPS.
 *
 * La app, cuando tiene PROCESADOR_LAMBDA configurado, le pide a una Lambda al
 * lado de S3 las vistas previas de cada foto, y si falla las hace ella, más
 * lento. Eso no se ve en ningún otro número: las fotos se siguen procesando.
 * Por eso la app anota su estado en Setting (ver derivados-lambda.ts): si está
 * en pausa por fallos, el nombre del último error y cuántas fotos hizo cada
 * lado en la hora. Sin la fila, o con una de más de un día, el bloque sale en
 * null: la Lambda no está configurada o no procesó nada en ese tiempo.
 */

export const SQL_LAMBDA = `select value from "Setting" where key = 'procesador:lambda'`;

/** Con menos fotos en la hora, que la mayoría fuera al VPS no dice nada. */
const MUESTRA_MINIMA = 10;
/**
 * La app escribe la fila sólo cuando procesa fotos. Una de más de un día es de
 * una Lambda que se desconfiguró o de una semana sin subidas: en los dos casos
 * no dice nada de ahora.
 */
const VIGENCIA_MS = 24 * 3600_000;
/** El nombre de un error de AWS o del SDK; cualquier otra cosa no sale. */
const NOMBRE_ERROR = /^[A-Za-z][\w:.-]{0,59}$/;

export type DerivadosLambda = {
  status: "active" | "paused";
  paused_until: string | null;
  last_error: string | null;
  in_lambda_last_hour: number;
  in_vps_last_hour: number;
  updated_at: string | null;
};

type Fila = {
  actualizado?: unknown;
  pausaHasta?: unknown;
  ultimoError?: unknown;
  hora?: unknown;
  enLambda?: unknown;
  enLocal?: unknown;
};

function fecha(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

function cuenta(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
}

export function evaluarLambda(
  valor: string | undefined,
  ahora: Date,
): { lambda: DerivadosLambda | null; estado: Estado; alertas: Alerta[] } {
  if (!valor) return { lambda: null, estado: "ok", alertas: [] };
  let f: Fila;
  try {
    const crudo: unknown = JSON.parse(valor);
    if (typeof crudo !== "object" || crudo === null || Array.isArray(crudo)) {
      return { lambda: null, estado: "ok", alertas: [] };
    }
    f = crudo as Fila;
  } catch {
    return { lambda: null, estado: "ok", alertas: [] };
  }
  const actualizado = fecha(f.actualizado);
  if (!actualizado || ahora.getTime() - Date.parse(actualizado) > VIGENCIA_MS) {
    return { lambda: null, estado: "ok", alertas: [] };
  }

  const pausa = fecha(f.pausaHasta);
  const pausada = pausa !== null && Date.parse(pausa) > ahora.getTime();
  const ultimoError = typeof f.ultimoError === "string" && NOMBRE_ERROR.test(f.ultimoError) ? f.ultimoError : f.ultimoError ? "otro" : null;
  // Las cuentas son de la hora que anotó la app; si es otra hora, no dicen nada de ahora.
  const estaHora = ahora.toISOString().slice(0, 13);
  const vigentes = f.hora === estaHora;
  const enLambda = vigentes ? cuenta(f.enLambda) : 0;
  const enVps = vigentes ? cuenta(f.enLocal) : 0;

  const alertas: Alerta[] = [];
  let estado: Estado = "ok";
  if (pausada) {
    estado = peor(estado, "degraded");
    alertas.push({
      severity: "warning",
      code: "derivatives_lambda_paused",
      message:
        `La Lambda de derivados está en pausa hasta ${pausa} (UTC) porque falló varias veces seguidas` +
        (ultimoError ? ` (último error: ${ultimoError})` : "") +
        ". Las vistas previas se hacen en el VPS, bastante más lento.",
    });
  } else if (enLambda + enVps >= MUESTRA_MINIMA && enVps > enLambda) {
    estado = peor(estado, "degraded");
    alertas.push({
      severity: "warning",
      code: "derivatives_lambda_bypassed",
      message:
        `En la última hora ${enVps} de ${enLambda + enVps} vistas previas se hicieron en el VPS aunque la Lambda está configurada` +
        (ultimoError ? ` (último error: ${ultimoError})` : "") +
        ".",
    });
  }

  return {
    lambda: {
      status: pausada ? "paused" : "active",
      paused_until: pausada ? pausa : null,
      last_error: ultimoError,
      in_lambda_last_hour: enLambda,
      in_vps_last_hour: enVps,
      updated_at: actualizado,
    },
    estado,
    alertas,
  };
}
