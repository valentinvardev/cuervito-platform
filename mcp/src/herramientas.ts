import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import * as z from "zod";

import { leerAlarmas, type Alarmas } from "./aws.js";
import type { Config } from "./config.js";
import type { Lector } from "./db.js";
import { aErrorSeguro, cuerpoError } from "./errores.js";
import { activacion } from "./metricas/activacion.js";
import { peor, salud } from "./metricas/salud.js";
import { semana } from "./metricas/semana.js";
import { uso } from "./metricas/uso.js";
import { ventas } from "./metricas/ventas.js";
import { describir, resolverPeriodo, resolverSemana, semanaAnterior } from "./periodo.js";
import { verificarSalida } from "./privacidad.js";
import { SERVICIO, VERSION } from "./version.js";

/**
 * Las seis herramientas. Todas de lectura, y dicho también en las anotaciones
 * de MCP para que el cliente lo sepa sin tener que creerle a la descripción.
 *
 * Cada una termina en `responder`, que es el único camino de salida: agrega la
 * hora, pasa el resultado por el control de privacidad y lo convierte al
 * formato de MCP. Si algo falla, el error se reemplaza por uno de texto fijo.
 */

export type Dependencias = {
  lector: Lector;
  cfg: Config;
  ahora?: () => Date;
  alarmas?: () => Promise<Alarmas>;
  /** Para el registro: nombre de la herramienta y código de error, nunca los argumentos. */
  alFallar?: (herramienta: string, codigo: string) => void;
};

const SOLO_LECTURA = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

const entradaPeriodo = {
  period: z
    .enum(["today", "last_7d", "last_30d", "custom"])
    .default("last_7d")
    .describe("today: hoy. last_7d: hoy y los 6 días anteriores. last_30d: hoy y los 29 anteriores. custom: usa from y to."),
  from: z.string().regex(FECHA).optional().describe("Con period=custom: primer día, YYYY-MM-DD, inclusive."),
  to: z.string().regex(FECHA).optional().describe("Con period=custom: último día, YYYY-MM-DD, inclusive. Máximo 366 días."),
};

export function registrarHerramientas(server: McpServer, deps: Dependencias): void {
  const ahora = deps.ahora ?? (() => new Date());
  const alarmas = deps.alarmas ?? (() => leerAlarmas(deps.cfg.aws));

  async function responder(herramienta: string, trabajo: () => Promise<object>): Promise<CallToolResult> {
    try {
      const resultado = { ...(await trabajo()), generated_at: ahora().toISOString() };
      verificarSalida(resultado);
      return {
        content: [{ type: "text", text: JSON.stringify(resultado, null, 2) }],
        structuredContent: resultado as Record<string, unknown>,
      };
    } catch (e) {
      const seguro = aErrorSeguro(e);
      deps.alFallar?.(herramienta, seguro.codigo);
      return {
        isError: true,
        content: [{ type: "text", text: JSON.stringify(cuerpoError(seguro.codigo, seguro.mensajeSeguro)) }],
      };
    }
  }

  // ── ping ──────────────────────────────────────────────────────────────────
  server.registerTool(
    "ping",
    {
      title: "Ping",
      description: "Chequeo del servidor MCP. No consulta la base: sirve para saber que el servidor responde y qué versión corre.",
      annotations: SOLO_LECTURA,
    },
    async () =>
      responder("ping", async () => ({ ok: true, service: SERVICIO, version: VERSION, timestamp: ahora().toISOString() })),
  );

  // ── get_health ────────────────────────────────────────────────────────────
  server.registerTool(
    "get_health",
    {
      title: "Salud técnica",
      description: [
        "Estado de ahora mismo del procesamiento de fotos y de los pagos, con alertas accionables.",
        "status de cada parte: ok, degraded (mirarlo hoy) o down (hacer algo ya).",
        "photo_processing: fotos pendientes de vista previa (no se ven en la tienda hasta tenerla), cuántas llevan más de 1 h, cuántas quedaron apartadas tras 4 intentos, cuántas se procesaron en la última hora y hace cuántos segundos terminó la última. timings: mediana y p90 del tiempo por foto de las últimas procesadas.",
        "payments: últimas 24 h. failure_rate = fallidas / (pagadas + fallidas). pending_unconfirmed: ventas de más de 1 h sin confirmar; abandoned_checkouts: sin confirmar de más de 24 h en los últimos 30 días (checkouts abandonados, normal).",
        "errors: errores de procesamiento VIGENTES (fotos que hoy siguen sin vista previa y con error), agrupados por código; y pagos fallidos de las últimas 24 h. Nunca incluye mensajes ni identificadores.",
      ].join(" "),
      annotations: SOLO_LECTURA,
    },
    async () =>
      responder("get_health", async () => {
        const s = await deps.lector((q) => salud(q, ahora()));
        const aws = await alarmas();
        let status = s.status;
        if (aws.available && aws.alarms_in_alarm > 0) {
          status = peor(status, "degraded");
          s.alerts.push({
            severity: "warning",
            code: "cloudwatch_alarms",
            message: `${aws.alarms_in_alarm} alarmas de CloudWatch están en estado ALARM.`,
          });
        }
        return { ...s, status, aws };
      }),
  );

  // ── get_activation ────────────────────────────────────────────────────────
  server.registerTool(
    "get_activation",
    {
      title: "Activación de fotógrafos",
      description: [
        "Embudo de activación de la cohorte de fotógrafos que se REGISTRÓ en el período.",
        "De esa cohorte: cuántos crearon al menos un evento y cuántos subieron al menos una foto, contando lo que hicieron hasta el fin del período (no hasta hoy), para que dos períodos se puedan comparar.",
        "registered_no_event: se registraron y no crearon evento. event_no_photos: crearon evento y no subieron fotos.",
        "rates: with_event y with_photos sobre los registrados; event_to_photos sobre los que crearon evento. null si el denominador es cero.",
      ].join(" "),
      inputSchema: entradaPeriodo,
      annotations: SOLO_LECTURA,
    },
    async (args) =>
      responder("get_activation", async () => {
        const p = resolverPeriodo(args, deps.cfg.zona, ahora());
        const r = await deps.lector((q) => activacion(q, p));
        return { period: describir(p), ...r };
      }),
  );

  // ── get_usage ─────────────────────────────────────────────────────────────
  server.registerTool(
    "get_usage",
    {
      title: "Uso de la plataforma",
      description: [
        "Qué pasó en el período: eventos creados, fotos subidas (terminadas y no borradas) y búsquedas por cara.",
        "dorsal_searches sale en null: las búsquedas por dorsal no se registran en ninguna tabla. La razón viene en unavailable_reason.",
      ].join(" "),
      inputSchema: entradaPeriodo,
      annotations: SOLO_LECTURA,
    },
    async (args) =>
      responder("get_usage", async () => {
        const p = resolverPeriodo(args, deps.cfg.zona, ahora());
        const r = await deps.lector((q) => uso(q, p));
        return { period: describir(p), ...r };
      }),
  );

  // ── get_sales ─────────────────────────────────────────────────────────────
  server.registerTool(
    "get_sales",
    {
      title: "Ventas agregadas",
      description: [
        "Totales de ventas del período. Nunca montos por compra ni datos del comprador.",
        "purchases_count: ventas pagadas, por fecha de pago. purchases_gross: total bruto por moneda, en unidades (no centavos); si una moneda tiene menos compras que el mínimo de privacidad, amount sale en null y suppressed en true.",
        "payments_failed: pagos fallidos, que incluyen los rechazados y cancelados de Mercado Pago. payments_rejected sale en null: no se registran por separado.",
        "failure_rate = fallidas / (pagadas + fallidas). gifts_count: entregas regaladas, que no son plata cobrada.",
      ].join(" "),
      inputSchema: entradaPeriodo,
      annotations: SOLO_LECTURA,
    },
    async (args) =>
      responder("get_sales", async () => {
        const p = resolverPeriodo(args, deps.cfg.zona, ahora());
        const r = await deps.lector((q) => ventas(q, p, deps.cfg.grupoMinimo));
        return { period: describir(p), ...r };
      }),
  );

  // ── get_weekly_snapshot ───────────────────────────────────────────────────
  server.registerTool(
    "get_weekly_snapshot",
    {
      title: "Resumen semanal",
      description: [
        "Activación, uso y ventas de una semana de lunes a domingo, con la salud de ahora (health_now).",
        "Sin week_start usa la última semana completa. Con include_previous_week (por defecto sí) agrega la semana anterior y los deltas de cada métrica: current, previous, change y change_pct (null si la anterior es cero).",
        "health_now es el estado actual, no el de esa semana: no hay historia de salud guardada.",
      ].join(" "),
      inputSchema: {
        week_start: z.string().regex(FECHA).optional().describe("Lunes de la semana, YYYY-MM-DD. Sin esto, la última semana completa."),
        include_previous_week: z.boolean().default(true).describe("Agregar la semana anterior y los deltas."),
      },
      annotations: SOLO_LECTURA,
    },
    async (args) =>
      responder("get_weekly_snapshot", async () => {
        const p = resolverSemana(args.week_start, deps.cfg.zona, ahora());
        const anterior = args.include_previous_week ? semanaAnterior(p) : null;
        return deps.lector((q) => semana(q, p, anterior, deps.cfg.grupoMinimo, ahora()));
      }),
  );
}
