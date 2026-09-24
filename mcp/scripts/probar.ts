/**
 * Prueba de punta a punta con el cliente MCP oficial, como lo haría un agente.
 *
 *   npm run probar                       levanta el servidor acá y lo prueba
 *   MCP_URL=https://… npm run probar     prueba un servidor ya deployado
 *
 * En los dos casos hace falta MCP_TOKEN. Sin MCP_URL también hace falta
 * DATABASE_URL, porque el servidor local consulta la base de verdad (en una
 * transacción de sólo lectura, como siempre).
 *
 * Imprime la lista de herramientas y la respuesta de cada una, y termina con
 * un resumen. Sale con código 1 si alguna falló.
 */
import type { AddressInfo } from "node:net";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

import { leerConfig } from "../src/config.js";
import { crearLector, crearPool } from "../src/db.js";
import { lectorCostosCompartido } from "../src/costos/cost-explorer.js";
import { registrarHerramientas } from "../src/herramientas.js";
import { crearServidorHttp } from "../src/http.js";

const token = process.env.MCP_TOKEN ?? "";
if (!token) {
  console.error("Falta MCP_TOKEN.");
  process.exit(1);
}

let url = process.env.MCP_URL ?? "";
let cerrarLocal: (() => Promise<void>) | null = null;

if (!url) {
  const cfg = leerConfig();
  const pool = crearPool(cfg);
  const lector = crearLector(pool, cfg.timeoutConsultaMs);

  // Antes que nada: que la transacción sea de verdad de sólo lectura.
  const soloLectura = await lector(async (q) => (await q<{ transaction_read_only: string }>("show transaction_read_only"))[0]);
  console.log(`transacción de sólo lectura: ${soloLectura?.transaction_read_only}`);
  if (soloLectura?.transaction_read_only !== "on") {
    console.error("La transacción NO es de sólo lectura. No sigo.");
    process.exit(1);
  }

  const servidor = crearServidorHttp({
    cfg,
    registrar: (s) => registrarHerramientas(s, { lector, cfg, costosMedidos: lectorCostosCompartido(cfg.costExplorer) }),
    log: () => undefined,
  });
  await new Promise<void>((r) => servidor.listen(0, "127.0.0.1", r));
  const { port } = servidor.address() as AddressInfo;
  url = `http://127.0.0.1:${port}/mcp`;
  cerrarLocal = async () => {
    await new Promise<void>((r) => servidor.close(() => r()));
    await pool.end();
  };
}

const cliente = new Client({ name: "probar-encontrate-ops", version: "1.0.0" });
await cliente.connect(
  new StreamableHTTPClientTransport(new URL(url), { requestInit: { headers: { Authorization: `Bearer ${token}` } } }),
);

const { tools } = await cliente.listTools();
console.log(`\n${tools.length} herramientas en ${url.replace(/\/\/[^/]+/, "//…")}:`);
for (const t of tools) {
  const soloLectura = t.annotations?.readOnlyHint === true ? "sólo lectura" : "¡NO marcada como sólo lectura!";
  console.log(`  · ${t.name} (${soloLectura})`);
}

const llamadas: [string, Record<string, unknown>][] = [
  ["ping", {}],
  ["get_health", {}],
  ["get_activation", { period: "last_30d" }],
  ["get_usage", { period: "last_7d" }],
  ["get_sales", { period: "last_30d" }],
  ["get_sales", { period: "today" }],
  ["get_weekly_snapshot", {}],
  ["get_aws_costs", {}],
  // Errores esperados: el servidor tiene que contestarlos bien, no romperse.
  ["get_usage", { period: "custom", from: "2026-09-10" }],
  ["get_weekly_snapshot", { week_start: "2026-09-16" }],
];

let fallas = 0;
for (const [nombre, args] of llamadas) {
  const t = Date.now();
  const r = await cliente.callTool({ name: nombre, arguments: args });
  const texto = (r.content as { type: string; text?: string }[]).find((c) => c.type === "text")?.text ?? "";
  const esperabaError = nombre === "get_usage" && args.period === "custom" || args.week_start === "2026-09-16";
  const bien = esperabaError ? r.isError === true : r.isError !== true;
  if (!bien) fallas++;
  console.log(`\n── ${nombre} ${JSON.stringify(args)} · ${Date.now() - t} ms · ${bien ? "ok" : "FALLÓ"}${esperabaError ? " (error esperado)" : ""}`);
  console.log(texto);
}

await cliente.close();
await cerrarLocal?.();
console.log(`\n${fallas === 0 ? "Todo bien." : `${fallas} llamadas no dieron lo esperado.`}`);
process.exit(fallas === 0 ? 0 : 1);
