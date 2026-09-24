import { readFileSync } from "node:fs";
import type http from "node:http";
import type { AddressInfo } from "node:net";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { afterEach, describe, expect, it } from "vitest";

import { leerConfig } from "../src/config.js";
import { registrarHerramientas } from "../src/herramientas.js";
import { crearServidorHttp, Limitador } from "../src/http.js";
import { VERSION } from "../src/version.js";
import { AHORA, CFG, FILAS_NORMALES, TOKEN, lectorFalso } from "./ayuda.js";

/**
 * El servidor HTTP de verdad, en un puerto al azar, con la base falsa. Prueba
 * lo que un agente ve por la red: autenticación, límites y el protocolo.
 */

let servidor: http.Server | null = null;
afterEach(async () => {
  if (servidor) await new Promise<void>((r) => servidor!.close(() => r()));
  servidor = null;
});

async function levantar(cfg = CFG): Promise<string> {
  servidor = crearServidorHttp({
    cfg,
    registrar: (s) =>
      registrarHerramientas(s, {
        lector: lectorFalso(FILAS_NORMALES),
        cfg,
        ahora: () => AHORA,
        alarmas: async () => ({ available: false, unavailable_reason: "test" }),
      }),
    log: () => undefined,
  });
  await new Promise<void>((r) => servidor!.listen(0, "127.0.0.1", r));
  return `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
}

const INICIALIZAR = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "0" } },
};

function post(base: string, cuerpo: unknown, cabeceras: Record<string, string> = {}) {
  return fetch(`${base}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...cabeceras },
    body: typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo),
  });
}

describe("autenticación", () => {
  it("sin token: 401 en JSON, con WWW-Authenticate", async () => {
    const base = await levantar();
    const r = await post(base, INICIALIZAR);
    expect(r.status).toBe(401);
    expect(r.headers.get("www-authenticate")).toMatch(/^Bearer/);
    expect(await r.json()).toMatchObject({ error: { code: "unauthorized" } });
  });

  it("con un token equivocado: 401", async () => {
    const base = await levantar();
    const r = await post(base, INICIALIZAR, { authorization: `Bearer ${"x".repeat(48)}` });
    expect(r.status).toBe(401);
  });

  it("con el token en otro esquema (Basic): 401", async () => {
    const base = await levantar();
    const r = await post(base, INICIALIZAR, { authorization: `Basic ${TOKEN}` });
    expect(r.status).toBe(401);
  });

  it("muchos intentos fallidos desde la misma IP: 429", async () => {
    const base = await levantar({ ...CFG, fallosAuthPorMinuto: 3 });
    const estados: number[] = [];
    for (let i = 0; i < 5; i++) estados.push((await post(base, INICIALIZAR, { authorization: "Bearer mal" })).status);
    expect(estados).toEqual([401, 401, 401, 429, 429]);
  });

  it("con el token bien, un cliente MCP de verdad conecta y llama", async () => {
    const base = await levantar();
    const c = new Client({ name: "t", version: "0" });
    await c.connect(
      new StreamableHTTPClientTransport(new URL(`${base}/mcp`), { requestInit: { headers: { Authorization: `Bearer ${TOKEN}` } } }),
    );
    const { tools } = await c.listTools();
    expect(tools).toHaveLength(7);
    const r = await c.callTool({ name: "ping", arguments: {} });
    expect(JSON.parse((r.content as { text: string }[])[0]!.text)).toMatchObject({ ok: true, version: VERSION });
    await c.close();
  });
});

describe("límites", () => {
  it("más pedidos por minuto que el límite: 429 con Retry-After", async () => {
    const base = await levantar({ ...CFG, limitePorMinuto: 2 });
    const auth = { authorization: `Bearer ${TOKEN}` };
    const estados = [];
    for (let i = 0; i < 3; i++) estados.push(await post(base, INICIALIZAR, auth));
    expect(estados.map((r) => r.status)).toEqual([200, 200, 429]);
    expect(Number(estados[2]!.headers.get("retry-after"))).toBeGreaterThan(0);
  });

  it("un cuerpo de más de 64 KB: 413", async () => {
    const base = await levantar();
    const r = await post(base, JSON.stringify({ relleno: "a".repeat(70_000) }), { authorization: `Bearer ${TOKEN}` });
    expect(r.status).toBe(413);
  });

  it("JSON roto: 400 con error de JSON-RPC", async () => {
    const base = await levantar();
    const r = await post(base, "{no es json", { authorization: `Bearer ${TOKEN}` });
    expect(r.status).toBe(400);
    expect(await r.json()).toMatchObject({ error: { code: -32700 } });
  });

  it("el limitador libera el lugar cuando pasa la ventana", () => {
    const l = new Limitador(1, 1_000);
    expect(l.permitir("a", 0).ok).toBe(true);
    expect(l.permitir("a", 500).ok).toBe(false);
    expect(l.permitir("a", 1_001).ok).toBe(true);
  });
});

describe("rutas", () => {
  it("GET /healthz contesta sin token y sin datos", async () => {
    const base = await levantar();
    const r = await fetch(`${base}/healthz`);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, service: "encontrate-ops-mcp", version: VERSION });
  });

  it("GET /mcp: 405, sólo se acepta POST", async () => {
    const base = await levantar();
    const r = await fetch(`${base}/mcp`, { headers: { authorization: `Bearer ${TOKEN}` } });
    expect(r.status).toBe(405);
  });

  it("otra ruta: 404", async () => {
    const base = await levantar();
    expect((await fetch(`${base}/`)).status).toBe(404);
  });
});

describe("configuración", () => {
  const BASE = { DATABASE_URL: "postgres://u:p@h/db", MCP_TOKEN: TOKEN };

  it("no arranca sin token", () => {
    expect(() => leerConfig({ DATABASE_URL: "postgres://u:p@h/db" })).toThrow(/MCP_TOKEN/);
  });
  it("no arranca con un token corto", () => {
    expect(() => leerConfig({ ...BASE, MCP_TOKEN: "corto" })).toThrow(/32/);
  });
  it("no arranca sin base", () => {
    expect(() => leerConfig({ MCP_TOKEN: TOKEN })).toThrow(/DATABASE_URL/);
  });
  it("no arranca con una zona horaria inventada", () => {
    expect(() => leerConfig({ ...BASE, METRICS_TZ: "Marte/Olympus" })).toThrow(/zona/);
  });
  it("CloudWatch queda apagado si falta la región o el prefijo", () => {
    expect(leerConfig({ ...BASE, AWS_REGION: "us-east-2" }).aws).toBeNull();
    expect(leerConfig({ ...BASE, AWS_REGION: "us-east-2", CLOUDWATCH_ALARM_PREFIX: "encontrate-" }).aws).toEqual({
      region: "us-east-2",
      prefijoAlarmas: "encontrate-",
    });
  });
  it("la versión del código es la del package.json", () => {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string };
    expect(VERSION).toBe(pkg.version);
  });
});
