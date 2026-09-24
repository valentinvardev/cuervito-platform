import { describe, expect, it } from "vitest";

import { SQL_ACTIVACION } from "../src/metricas/activacion.js";
import { SQL_ERRORES_FOTOS, SQL_FOTOS, SQL_PAGOS, SQL_TIEMPOS } from "../src/metricas/salud.js";
import { SQL_USO } from "../src/metricas/uso.js";
import { SQL_VENTAS } from "../src/metricas/ventas.js";

/**
 * Las consultas, leídas como texto. La transacción de sólo lectura ya
 * impediría una escritura en producción; esto la frena antes, en el test, y
 * además controla las columnas: que ninguna consulta toque una columna con
 * datos personales, ni siquiera para filtrar.
 */

const TODAS: [string, string][] = [
  ["activación", SQL_ACTIVACION],
  ["uso", SQL_USO],
  ["ventas", SQL_VENTAS],
  ["salud: fotos", SQL_FOTOS],
  ["salud: errores", SQL_ERRORES_FOTOS],
  ["salud: pagos", SQL_PAGOS],
  ["salud: tiempos", SQL_TIEMPOS],
];

const ESCRITURA = /\b(insert|update|delete|merge|upsert|drop|alter|create|truncate|grant|revoke|copy|call|do|vacuum|reindex|cluster|lock|notify|listen|refresh|security|set\s+role|pg_sleep|lo_import|dblink)\b/i;

/** Columnas con datos de personas o de fotos individuales. Ninguna consulta las nombra. */
const COLUMNAS_PERSONALES = [
  "email", "name", "buyerEmail", "buyerName", "buyerPhone", "passwordHash", "image", "bio",
  "instagramUrl", "websiteUrl", "location", "slug", "mpAccessToken", "mpRefreshToken", "mpPublicKey",
  "mpUserId", "mpPaymentId", "mpPreferenceId", "mpOrderId", "downloadToken", "visitorId", "photoIds",
  "storageKey", "previewCleanKey", "thumbKey", "filename", "bibNumbers", "ip", "userAgent", "notes",
  "watermarkKey", "logoKey", "storefrontDomain",
];

describe.each(TODAS)("la consulta de %s", (_, sql) => {
  it("empieza con SELECT o WITH", () => {
    expect(sql.trim()).toMatch(/^(select|with)\b/i);
  });
  it("no tiene ninguna palabra de escritura", () => {
    expect(sql).not.toMatch(ESCRITURA);
  });
  it("no hace select *", () => {
    expect(sql).not.toMatch(/select\s+\*/i);
    expect(sql).not.toMatch(/\.\*/);
  });
  it("es una sola sentencia", () => {
    expect(sql.replace(/;\s*$/, "")).not.toContain(";");
  });
  it.each(COLUMNAS_PERSONALES)("no nombra la columna %s", (col) => {
    expect(sql).not.toMatch(new RegExp(`"${col}"`));
  });
});

it("todas las consultas que recorren tablas devuelven agregados, no filas", () => {
  // Salvo la de tiempos, que lee UNA fila de configuración por clave.
  for (const [nombre, sql] of TODAS.filter(([n]) => n !== "salud: tiempos")) {
    expect(sql, nombre).toMatch(/count\(|sum\(|max\(/i);
  }
});
