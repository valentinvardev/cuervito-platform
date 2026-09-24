/**
 * Los errores que puede ver un agente.
 *
 * Todo lo que sale del servidor pasa por acá, y el mensaje que se devuelve es
 * SIEMPRE uno de estos textos fijos. Nunca el texto de un error de Postgres o
 * de AWS: esos mensajes pueden traer valores de la consulta, nombres de
 * columnas o fragmentos de datos, y un agente los copia tal cual a un chat.
 */

export type CodigoError =
  | "invalid_period"
  | "invalid_input"
  | "privacy_violation"
  | "db_unavailable"
  | "db_timeout"
  | "internal";

export class ErrorHerramienta extends Error {
  constructor(
    readonly codigo: CodigoError,
    readonly mensajeSeguro: string,
  ) {
    super(mensajeSeguro);
    this.name = "ErrorHerramienta";
  }
}

export class ErrorPrivacidad extends ErrorHerramienta {
  constructor(readonly ruta: string) {
    // La ruta dice DÓNDE estaba el problema, nunca QUÉ valor era.
    super("privacy_violation", `La respuesta tenía un campo no permitido en ${ruta} y no se envió.`);
    this.name = "ErrorPrivacidad";
  }
}

/** Cualquier error, convertido a uno que se puede mostrar. */
export function aErrorSeguro(e: unknown): ErrorHerramienta {
  if (e instanceof ErrorHerramienta) return e;

  const codigoPg = (e as { code?: unknown })?.code;
  // 57014: la consulta pasó el statement_timeout.
  if (codigoPg === "57014") {
    return new ErrorHerramienta("db_timeout", "La consulta tardó demasiado y se cortó. Probá con un período más corto.");
  }
  // Clase 08: errores de conexión. 53: recursos agotados. 28: autenticación.
  if (typeof codigoPg === "string" && /^(08|53|28|57P0)/.test(codigoPg)) {
    return new ErrorHerramienta("db_unavailable", "No se pudo consultar la base de datos.");
  }
  const texto = e instanceof Error ? e.message : "";
  if (/ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ECONNRESET|timeout exceeded when trying to connect/i.test(texto)) {
    return new ErrorHerramienta("db_unavailable", "No se pudo consultar la base de datos.");
  }
  return new ErrorHerramienta("internal", "Error interno al calcular la métrica.");
}

/** El cuerpo JSON de un error, con la misma forma en HTTP y en MCP. */
export function cuerpoError(codigo: CodigoError | "unauthorized" | "rate_limited" | "not_found" | "method_not_allowed" | "payload_too_large" | "bad_request", mensaje: string) {
  return { error: { code: codigo, message: mensaje } };
}
