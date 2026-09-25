/**
 * Lo que el MCP necesita saber de la cola de fotos de la aplicación.
 *
 * La cola vive en cuervito/src/server/cola-fotos.ts y guarda su estado en las
 * columnas de cada foto. Para leer esas columnas hay que saber lo mismo que
 * ella: cuántos intentos rápidos hace antes de pasar a reintentar despacio, en
 * cuántos se rinde, y cuánto dura un lease. Son copias, porque la app y el MCP
 * se despliegan por separado y no comparten código; test/reconocimiento.test.ts
 * lee el archivo de la app y falla si alguno de los dos cambia y el otro no.
 */

/** Intentos seguidos, a cinco minutos. Después, reintentos lentos. */
export const INTENTOS_RAPIDOS = 4;
/** En cuántos intentos se rinde la cola y deja la foto quieta. */
export const MAX_INTENTOS = 15;
/** Cuántas horas cubre la etapa lenta, para decirlo en las alertas. */
export const HORAS_ETAPA_LENTA = 175;
/** Cuánto dura la posesión de una foto: una unidad reclamada vence a los 25 min. */
export const LEASE_MIN = 25;
/** El tope de una unidad: a los 12 min la cola la da por perdida y la suelta. */
export const TOPE_MIN = 12;
/** Pasado el tope y un margen, una unidad sin soltar está colgada. */
export const COLGADA_MIN = TOPE_MIN + 3;

/** El instante de ahora en UTC, que es como están guardadas las fechas. */
export const AHORA = `(now() at time zone 'utc')`;

/**
 * Una foto que falló las rápidas y espera su reintento lento.
 *
 * Con coalesce porque un lease nulo haría NULL toda la condición, y un
 * `not (...)` sobre NULL deja la fila afuera de los dos lados.
 */
export const REINTENTANDO_DESPACIO = `(
  "processAttempts" >= ${INTENTOS_RAPIDOS} and "processAttempts" < ${MAX_INTENTOS}
  and coalesce("processLeaseUntil" > ${AHORA}, false) and "processError" is not null
  and "processError" not like 'cuota:%'
)`;

/**
 * Una unidad en vuelo desde hace más de COLGADA_MIN minutos: reclamada hace más
 * que el tope que tiene cualquier unidad, así que está colgada. El lease se
 * pone al reclamar a LEASE_MIN minutos, y de ahí sale cuándo se reclamó.
 */
export const COLGADA = `(
  "processError" is null and "processLeaseUntil" > ${AHORA}
  and "processLeaseUntil" < ${AHORA} + interval '${LEASE_MIN - COLGADA_MIN} minutes'
)`;

/**
 * Una unidad en vuelo que todavía no pasó el tope: eso sí es actividad de la
 * cola. Una colgada no: si contara, una cola trabada con una unidad colgada
 * parecería activa durante todo el lease.
 */
export const EN_VUELO_RECIENTE = `(
  "processError" is null and "processLeaseUntil" >= ${AHORA} + interval '${LEASE_MIN - COLGADA_MIN} minutes'
)`;
