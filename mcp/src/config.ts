/**
 * La configuración, leída una vez y validada al arrancar.
 *
 * Si falta algo obligatorio el proceso no arranca. Es a propósito: un servidor
 * de métricas que levanta sin token queda abierto, y uno que levanta sin base
 * contesta errores a todo. Las dos cosas es mejor verlas en el deploy que en
 * el primer pedido de un agente.
 */

export type Config = {
  puerto: number;
  databaseUrl: string;
  /** off: sin TLS (sólo local). require: cifrado sin verificar. verify: cifrado y certificado verificado. */
  dbSsl: "off" | "require" | "verify";
  token: string;
  zona: string;
  limitePorMinuto: number;
  fallosAuthPorMinuto: number;
  /** Tamaño mínimo de grupo para informar montos. Ver privacidad.ts. */
  grupoMinimo: number;
  timeoutConsultaMs: number;
  confiarEnProxy: boolean;
  aws: { region: string; prefijoAlarmas: string } | null;
  /** Leer el gasto medido de Cost Explorer. Cuesta un centavo por consulta; va con caché. */
  costExplorer: boolean;
  /**
   * Desde cuándo la app usa S3 Transfer Acceleration, o null si no la usa.
   * "true" es desde siempre; una fecha YYYY-MM-DD es desde ese día en UTC. La
   * fecha importa: el recargo es una parte grande del gasto, y cobrarlo el mes
   * entero cuando se prendió a mitad de mes infla la estimación.
   */
  aceleracionDesde: Date | null;
  /** Días que una foto borrada sigue en S3 antes de que el cron la purgue. Igual que en la app. */
  retencionDias: number;
};

/** Un entero del entorno RECIBIDO, no de process.env: así los tests pueden pasar el suyo. */
function entero(env: NodeJS.ProcessEnv, nombre: string, porDefecto: number, min: number, max: number): number {
  const crudo = env[nombre];
  if (crudo === undefined || crudo === "") return porDefecto;
  const n = Number(crudo);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new Error(`${nombre} tiene que ser un entero entre ${min} y ${max}.`);
  }
  return n;
}

function leerAceleracion(crudo: string | undefined): Date | null {
  if (!crudo || crudo === "false") return null;
  if (crudo === "true") return new Date(0);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(crudo);
  const fecha = m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) : null;
  if (!fecha || fecha.toISOString().slice(0, 10) !== crudo) {
    throw new Error("S3_TRANSFER_ACCELERATION tiene que ser true, false o una fecha YYYY-MM-DD.");
  }
  return fecha;
}

export function leerConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const databaseUrl = env.DATABASE_URL ?? "";
  if (!databaseUrl) throw new Error("Falta DATABASE_URL.");

  const token = env.MCP_TOKEN ?? "";
  // 32 caracteres es el piso para que no se pueda adivinar por fuerza bruta,
  // ni siquiera con el límite de intentos apagado.
  if (token.length < 32) throw new Error("MCP_TOKEN tiene que tener al menos 32 caracteres.");

  const zona = env.METRICS_TZ || "America/Argentina/Buenos_Aires";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zona });
  } catch {
    throw new Error(`METRICS_TZ no es una zona horaria válida: ${zona}`);
  }

  const ssl = (env.DATABASE_SSL || "require").toLowerCase();
  if (ssl !== "off" && ssl !== "require" && ssl !== "verify") {
    throw new Error("DATABASE_SSL tiene que ser off, require o verify.");
  }

  const region = env.AWS_REGION || "";
  const prefijo = env.CLOUDWATCH_ALARM_PREFIX || "";

  return {
    puerto: entero(env, "PORT", 8787, 1, 65535),
    databaseUrl,
    dbSsl: ssl,
    token,
    zona,
    limitePorMinuto: entero(env, "RATE_LIMIT_PER_MIN", 60, 1, 10_000),
    fallosAuthPorMinuto: entero(env, "AUTH_FAILURES_PER_MIN", 20, 1, 10_000),
    grupoMinimo: entero(env, "MIN_GROUP_SIZE", 5, 2, 1_000),
    timeoutConsultaMs: entero(env, "DB_STATEMENT_TIMEOUT_MS", 8000, 500, 60_000),
    confiarEnProxy: env.TRUST_PROXY === "true",
    // CloudWatch es opcional: sin región y prefijo, las alarmas salen como
    // "no disponibles" y nada más.
    aws: region && prefijo ? { region, prefijoAlarmas: prefijo } : null,
    costExplorer: env.AWS_COST_EXPLORER === "true",
    aceleracionDesde: leerAceleracion(env.S3_TRANSFER_ACCELERATION),
    retencionDias: entero(env, "PHOTO_RETENTION_DAYS", 30, 1, 365),
  };
}
