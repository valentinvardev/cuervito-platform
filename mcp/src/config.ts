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
};

function entero(nombre: string, porDefecto: number, min: number, max: number): number {
  const crudo = process.env[nombre];
  if (crudo === undefined || crudo === "") return porDefecto;
  const n = Number(crudo);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new Error(`${nombre} tiene que ser un entero entre ${min} y ${max}.`);
  }
  return n;
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
    puerto: entero("PORT", 8787, 1, 65535),
    databaseUrl,
    dbSsl: ssl,
    token,
    zona,
    limitePorMinuto: entero("RATE_LIMIT_PER_MIN", 60, 1, 10_000),
    fallosAuthPorMinuto: entero("AUTH_FAILURES_PER_MIN", 20, 1, 10_000),
    grupoMinimo: entero("MIN_GROUP_SIZE", 5, 2, 1_000),
    timeoutConsultaMs: entero("DB_STATEMENT_TIMEOUT_MS", 8000, 500, 60_000),
    confiarEnProxy: env.TRUST_PROXY === "true",
    // CloudWatch es opcional: sin región y prefijo, las alarmas salen como
    // "no disponibles" y nada más.
    aws: region && prefijo ? { region, prefijoAlarmas: prefijo } : null,
  };
}
