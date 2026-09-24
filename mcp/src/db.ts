import pg from "pg";

import type { Config } from "./config.js";

/**
 * La única forma de hablar con la base: una transacción de sólo lectura.
 *
 * `leer(trabajo)` abre `BEGIN TRANSACTION READ ONLY`, fija un tope de tiempo
 * con `SET LOCAL`, corre las consultas y cierra. No hay otra función que
 * ejecute SQL en este servidor, así que "sólo lectura" no depende de que cada
 * consulta esté bien escrita: si una intentara escribir, Postgres la
 * rechazaría con "cannot execute ... in a read-only transaction".
 *
 * Es la segunda de tres capas. La primera es el rol de base (ver README): uno
 * que sólo tiene SELECT sobre las columnas que se usan. La tercera es que
 * todas las consultas son agregados. Con cualquiera de las tres alcanzaría;
 * están las tres porque cada una falla distinto.
 *
 * `SET LOCAL` y no `SET`: el pooler de Supabase trabaja por transacción, y un
 * `SET` de sesión quedaría pegado a una conexión que después usa otro cliente.
 * `SET LOCAL` muere con la transacción.
 */

export type Consulta = <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T[]>;
export type Lector = <R>(trabajo: (q: Consulta) => Promise<R>) => Promise<R>;

export function crearPool(cfg: Config): pg.Pool {
  // El sslmode de la URL se saca y se decide acá: pg interpreta
  // sslmode=require como verify-full desde la 8.x, y con el certificado del
  // pooler de Supabase eso falla sin la CA. Mejor una sola fuente de verdad.
  const url = new URL(cfg.databaseUrl);
  url.searchParams.delete("sslmode");
  url.searchParams.delete("pgbouncer");
  url.searchParams.delete("connection_limit");

  return new pg.Pool({
    connectionString: url.toString(),
    ssl: cfg.dbSsl === "off" ? false : { rejectUnauthorized: cfg.dbSsl === "verify" },
    // Pocas: son consultas de métricas, no tráfico de usuarios.
    max: 3,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 8_000,
    application_name: "encontrate-ops-mcp",
  });
}

export function crearLector(pool: pg.Pool, timeoutMs: number): Lector {
  const tope = Math.floor(timeoutMs);
  return async (trabajo) => {
    const cliente = await pool.connect();
    try {
      await cliente.query("BEGIN TRANSACTION READ ONLY");
      await cliente.query(`SET LOCAL statement_timeout = ${tope}`);
      const q: Consulta = async (sql, params = []) => (await cliente.query(sql, params)).rows;
      const resultado = await trabajo(q);
      await cliente.query("COMMIT");
      return resultado;
    } catch (e) {
      await cliente.query("ROLLBACK").catch(() => undefined);
      throw e;
    } finally {
      cliente.release();
    }
  };
}
