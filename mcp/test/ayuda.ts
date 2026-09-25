import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { Alarmas } from "../src/aws.js";
import type { CostosMedidos } from "../src/costos/cost-explorer.js";
import type { Config } from "../src/config.js";
import type { Consulta, Lector } from "../src/db.js";
import { registrarHerramientas } from "../src/herramientas.js";
import { SQL_ACTIVACION } from "../src/metricas/activacion.js";
import {
  SQL_COSTOS_ALMACENAMIENTO,
  SQL_COSTOS_CARAS,
  SQL_COSTOS_DESCARGAS,
  SQL_COSTOS_REKOGNITION,
  SQL_COSTOS_TRAFICO,
} from "../src/metricas/costos.js";
import {
  SQL_ERRORES_RECONOCIMIENTO,
  SQL_FRENO_RECONOCIMIENTO,
  SQL_RECONOCIMIENTO,
} from "../src/metricas/reconocimiento.js";
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
  costExplorer: false,
  aceleracionDesde: null,
  retencionDias: 30,
};

/** Un instante fijo: miércoles 23/9/2026 a las 15:00 en Buenos Aires. */
export const AHORA = new Date("2026-09-23T18:00:00Z");

export type Filas = Partial<
  Record<
    | "activacion" | "uso" | "ventas" | "fotos" | "errores" | "pagos" | "tiempos" | "reconocimiento" | "erroresRek" | "freno"
    | "costosRek" | "costosAlm" | "costosCaras" | "costosTrafico" | "costosDescargas",
    unknown[]
  >
>;

const GB = 1_073_741_824;

/** Filas agregadas plausibles, como las que devuelve la base de verdad. */
export const FILAS_NORMALES: Filas = {
  activacion: [{ registrados: 20, con_evento: 8, con_fotos: 5 }],
  uso: [{ eventos: 6, fotos: 2400, busquedas_cara: 150 }],
  ventas: [{ moneda: "ARS", pagadas: 57, bruto_centavos: "17100000", fallidas: 2, regalos: 1 }],
  fotos: [{
    pendientes: 0, pendientes_1h: 0, en_vuelo: 0, colgadas: 0, apartadas: 0, reintentando: 0,
    reintentando_despacio: 0, libres: 0, libres_15m: 0, trabajables_1h: 0, ultima_hora: 40,
    edad_ultimo_exito_s: 35, edad_actividad_s: 35,
  }],
  errores: [],
  reconocimiento: [{
    faltan: 0, apartadas: 0, esperando_cuota: 0, reintentando: 0, reintentando_despacio: 0,
    en_vuelo: 0, colgadas: 0, en_cola: 0, en_cola_15m: 0, en_cola_3h: 0, rechazadas: 0,
    rechazadas_7d: 0, apagado_fotos: 0, apagado_eventos: 0, reconocidas_7d: 500, sin_caras_7d: 40,
    edad_ultimo_s: 120,
  }],
  erroresRek: [],
  freno: [],
  pagos: [{ pagadas: 6, fallidas: 0, sin_confirmar: 0, abandonadas: 3 }],
  tiempos: [],
  // Números redondos para que las cuentas de los tests se puedan hacer a mano.
  costosRek: [{ texto: 1000, indexado: 1000, busquedas: 50 }],
  costosAlm: [{ byte_segundos: 100 * GB * 30 * 86_400, bytes_al_final: 120 * GB }],
  costosCaras: [{ cara_segundos: 10_000 * 30 * 86_400, caras_al_final: 12_000 }],
  costosTrafico: [{
    subidas: 1000, bytes_subidos: 15 * GB, bytes_subidos_acel: 5 * GB,
    procesadas: 1000, bytes_procesados: 15 * GB, bytes_procesados_acel: 5 * GB,
  }],
  costosDescargas: [{ sueltas: 200, bytes_sueltas: 3 * GB, fotos_en_zip: 100, bytes_zip: 2 * GB, bytes_descargas_acel: 1 * GB }],
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
    [SQL_RECONOCIMIENTO, "reconocimiento"],
    [SQL_ERRORES_RECONOCIMIENTO, "erroresRek"],
    [SQL_FRENO_RECONOCIMIENTO, "freno"],
    [SQL_PAGOS, "pagos"],
    [SQL_TIEMPOS, "tiempos"],
    [SQL_COSTOS_REKOGNITION, "costosRek"],
    [SQL_COSTOS_ALMACENAMIENTO, "costosAlm"],
    [SQL_COSTOS_CARAS, "costosCaras"],
    [SQL_COSTOS_TRAFICO, "costosTrafico"],
    [SQL_COSTOS_DESCARGAS, "costosDescargas"],
  ]);
  const q: Consulta = async <T>(sql: string) => {
    // Los savepoints de la salud (ver leerReconocimiento): no traen filas.
    if (/^(savepoint|release savepoint|rollback to savepoint) /i.test(sql)) return [] as T[];
    const clave = porSql.get(sql);
    if (!clave) throw new Error(`Consulta desconocida en el test: ${sql.slice(0, 60)}`);
    registro?.push(clave);
    return (filas[clave] ?? []) as T[];
  };
  return async (trabajo) => trabajo(q);
}

const SIN_ALARMAS: Alarmas = { available: false, unavailable_reason: "no configurado en el test" };

/** Un cliente MCP conectado en memoria a un servidor con la base falsa. */
const SIN_MEDICION: CostosMedidos = { available: false, unavailable_reason: "no configurado en el test" };

export async function clienteConectado(
  filas: Filas = FILAS_NORMALES,
  alarmas: Alarmas = SIN_ALARMAS,
  medidos: CostosMedidos = SIN_MEDICION,
  cfg: Config = CFG,
) {
  const server = new McpServer({ name: "test", version: "0" });
  registrarHerramientas(server, {
    lector: lectorFalso(filas),
    cfg,
    ahora: () => AHORA,
    alarmas: async () => alarmas,
    costosMedidos: async () => medidos,
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
