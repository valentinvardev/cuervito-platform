import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { Alarmas } from "../src/aws.js";
import type { Config } from "../src/config.js";
import type { Consulta, Lector } from "../src/db.js";
import { registrarHerramientas } from "../src/herramientas.js";
import { SQL_ACTIVACION } from "../src/metricas/activacion.js";
import { SQL_ERRORES_FOTOS, SQL_FOTOS, SQL_PAGOS, SQL_TIEMPOS } from "../src/metricas/salud.js";
import { SQL_USO } from "../src/metricas/uso.js";
import { SQL_VENTAS } from "../src/metricas/ventas.js";

/** Un token de prueba largo, para que leerConfig lo acepte. */
export const TOKEN = "t".repeat(48);

export const CFG: Config = {
  puerto: 0,
  databaseUrl: "postgres://no-se-usa/x",
  dbSsl: "off",
  token: TOKEN,
  zona: "America/Argentina/Buenos_Aires",
  limitePorMinuto: 60,
  fallosAuthPorMinuto: 20,
  grupoMinimo: 5,
  timeoutConsultaMs: 5000,
  confiarEnProxy: false,
  aws: null,
};

/** Un instante fijo: miércoles 23/9/2026 a las 15:00 en Buenos Aires. */
export const AHORA = new Date("2026-09-23T18:00:00Z");

export type Filas = Partial<Record<"activacion" | "uso" | "ventas" | "fotos" | "errores" | "pagos" | "tiempos", unknown[]>>;

/** Filas agregadas plausibles, como las que devuelve la base de verdad. */
export const FILAS_NORMALES: Filas = {
  activacion: [{ registrados: 20, con_evento: 8, con_fotos: 5 }],
  uso: [{ eventos: 6, fotos: 2400, busquedas_cara: 150 }],
  ventas: [{ moneda: "ARS", pagadas: 57, bruto_centavos: "17100000", fallidas: 2, regalos: 1 }],
  fotos: [{ pendientes: 0, pendientes_1h: 0, en_vuelo: 0, apartadas: 0, trabajables: 0, trabajables_1h: 0, ultima_hora: 40, edad_ultimo_exito_s: 35 }],
  errores: [],
  pagos: [{ pagadas: 6, fallidas: 0, sin_confirmar: 0, abandonadas: 3 }],
  tiempos: [],
};

/**
 * Una base falsa: reconoce cada consulta por su texto y devuelve las filas
 * que le toquen. Una consulta desconocida hace fallar el test, así un cambio
 * de SQL no pasa desapercibido.
 */
export function lectorFalso(filas: Filas, registro?: string[]): Lector {
  const porSql = new Map<string, keyof Filas>([
    [SQL_ACTIVACION, "activacion"],
    [SQL_USO, "uso"],
    [SQL_VENTAS, "ventas"],
    [SQL_FOTOS, "fotos"],
    [SQL_ERRORES_FOTOS, "errores"],
    [SQL_PAGOS, "pagos"],
    [SQL_TIEMPOS, "tiempos"],
  ]);
  const q: Consulta = async <T>(sql: string) => {
    const clave = porSql.get(sql);
    if (!clave) throw new Error(`Consulta desconocida en el test: ${sql.slice(0, 60)}`);
    registro?.push(clave);
    return (filas[clave] ?? []) as T[];
  };
  return async (trabajo) => trabajo(q);
}

const SIN_ALARMAS: Alarmas = { available: false, unavailable_reason: "no configurado en el test" };

/** Un cliente MCP conectado en memoria a un servidor con la base falsa. */
export async function clienteConectado(filas: Filas = FILAS_NORMALES, alarmas: Alarmas = SIN_ALARMAS) {
  const server = new McpServer({ name: "test", version: "0" });
  registrarHerramientas(server, {
    lector: lectorFalso(filas),
    cfg: CFG,
    ahora: () => AHORA,
    alarmas: async () => alarmas,
  });
  const [lado1, lado2] = InMemoryTransport.createLinkedPair();
  const cliente = new Client({ name: "test", version: "0" });
  await Promise.all([server.connect(lado1), cliente.connect(lado2)]);
  return cliente;
}

/** Llama a una herramienta y devuelve el JSON parseado del texto. */
export async function llamar(cliente: Client, nombre: string, args: Record<string, unknown> = {}) {
  const r = await cliente.callTool({ name: nombre, arguments: args });
  const texto = (r.content as { type: string; text: string }[])[0]!.text;
  return { esError: r.isError === true, json: JSON.parse(texto) as Record<string, unknown>, estructurado: r.structuredContent };
}

/** Todas las claves de un objeto, a cualquier profundidad. */
export function todasLasClaves(v: unknown, fuera: string[] = []): string[] {
  if (Array.isArray(v)) v.forEach((x) => todasLasClaves(x, fuera));
  else if (v && typeof v === "object") {
    for (const [k, x] of Object.entries(v)) {
      fuera.push(k);
      todasLasClaves(x, fuera);
    }
  }
  return fuera;
}

/** Todos los textos de un objeto, a cualquier profundidad. */
export function todosLosTextos(v: unknown, fuera: string[] = []): string[] {
  if (typeof v === "string") fuera.push(v);
  else if (Array.isArray(v)) v.forEach((x) => todosLosTextos(x, fuera));
  else if (v && typeof v === "object") Object.values(v).forEach((x) => todosLosTextos(x, fuera));
  return fuera;
}
