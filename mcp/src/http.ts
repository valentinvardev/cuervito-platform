import { createHash, timingSafeEqual } from "node:crypto";
import http from "node:http";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import type { Config } from "./config.js";
import { cuerpoError } from "./errores.js";
import { SERVICIO, VERSION } from "./version.js";

/**
 * El servidor HTTP: una sola ruta, `POST /mcp`, con Streamable HTTP sin estado.
 *
 * Sin estado quiere decir un McpServer nuevo por pedido, sin sesión y sin
 * nada guardado entre pedidos. Para un servidor de lectura es lo correcto: no
 * hay nada que recordar, se puede reiniciar o correr en varias instancias sin
 * que se rompa ningún cliente, y no hay sesiones que un agente pueda dejar
 * colgadas. Las respuestas son JSON plano (enableJsonResponse), no streams.
 *
 * El orden de los controles importa: primero el límite de intentos fallidos
 * por IP, después el token, después el límite por token, y recién ahí se lee
 * el cuerpo. Un pedido sin token no llega a costar ni un byte de lectura.
 */

const CUERPO_MAXIMO = 64 * 1024;

export class Limitador {
  private golpes = new Map<string, number[]>();
  constructor(
    private readonly maximo: number,
    private readonly ventanaMs = 60_000,
  ) {}

  permitir(clave: string, ahora = Date.now()): { ok: true } | { ok: false; reintentarEnS: number } {
    const desde = ahora - this.ventanaMs;
    const recientes = (this.golpes.get(clave) ?? []).filter((t) => t > desde);
    if (recientes.length >= this.maximo) {
      this.golpes.set(clave, recientes);
      return { ok: false, reintentarEnS: Math.max(1, Math.ceil((recientes[0]! + this.ventanaMs - ahora) / 1000)) };
    }
    recientes.push(ahora);
    this.golpes.set(clave, recientes);
    // Una IP nueva por pedido haría crecer el mapa sin fin: de vez en cuando
    // se tiran las claves que ya no tienen golpes en la ventana.
    if (this.golpes.size > 5_000) {
      for (const [k, v] of this.golpes) if (!v.some((t) => t > desde)) this.golpes.delete(k);
    }
    return { ok: true };
  }
}

function hash(s: string): Buffer {
  return createHash("sha256").update(s).digest();
}

/** Comparación en tiempo constante: los hashes miden lo mismo aunque el token no. */
function tokenValido(recibido: string, esperado: Buffer): boolean {
  return timingSafeEqual(hash(recibido), esperado);
}

function enviarJson(res: http.ServerResponse, estado: number, cuerpo: unknown, cabeceras: Record<string, string> = {}) {
  if (res.headersSent) return;
  res.writeHead(estado, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    ...cabeceras,
  });
  res.end(JSON.stringify(cuerpo));
}

function leerCuerpo(req: http.IncomingMessage): Promise<{ ok: true; texto: string } | { ok: false }> {
  return new Promise((resolve, reject) => {
    const partes: Buffer[] = [];
    let total = 0;
    let cortado = false;
    req.on("data", (c: Buffer) => {
      if (cortado) return;
      total += c.length;
      if (total > CUERPO_MAXIMO) {
        cortado = true;
        resolve({ ok: false });
        return;
      }
      partes.push(c);
    });
    req.on("end", () => {
      if (!cortado) resolve({ ok: true, texto: Buffer.concat(partes).toString("utf8") });
    });
    req.on("error", reject);
  });
}

function nombreHerramienta(cuerpo: unknown): string | undefined {
  const m = cuerpo as { method?: unknown; params?: { name?: unknown } } | null;
  if (m?.method === "tools/call" && typeof m.params?.name === "string") return m.params.name;
  return typeof m?.method === "string" ? m.method : undefined;
}

export function crearServidorHttp(opts: {
  cfg: Config;
  registrar: (server: McpServer) => void;
  log?: (linea: Record<string, unknown>) => void;
}): http.Server {
  const { cfg, registrar } = opts;
  const log = opts.log ?? ((l) => console.log(JSON.stringify(l)));
  const esperado = hash(cfg.token);
  const porToken = new Limitador(cfg.limitePorMinuto);
  const fallosPorIp = new Limitador(cfg.fallosAuthPorMinuto);

  function ipDe(req: http.IncomingMessage): string {
    if (cfg.confiarEnProxy) {
      const xff = req.headers["x-forwarded-for"];
      const primera = (Array.isArray(xff) ? xff[0] : xff)?.split(",")[0]?.trim();
      if (primera) return primera;
    }
    return req.socket.remoteAddress ?? "desconocida";
  }

  return http.createServer(async (req, res) => {
    const inicio = Date.now();
    const ruta = (req.url ?? "/").split("?")[0];
    let herramienta: string | undefined;

    res.on("finish", () => {
      // Nunca los argumentos ni la IP: lo que hace falta para operar es qué se
      // pidió, cómo terminó y cuánto tardó.
      log({ t: new Date().toISOString(), method: req.method, path: ruta, status: res.statusCode, ms: Date.now() - inicio, ...(herramienta ? { tool: herramienta } : {}) });
    });

    try {
      // Para el chequeo de la plataforma de deploy: sin token y sin datos.
      if (req.method === "GET" && ruta === "/healthz") {
        return enviarJson(res, 200, { ok: true, service: SERVICIO, version: VERSION });
      }

      if (ruta !== "/mcp") {
        return enviarJson(res, 404, cuerpoError("not_found", "Ruta inexistente. El endpoint MCP es POST /mcp."));
      }
      if (req.method !== "POST") {
        // Sin estado no hay stream de servidor ni sesiones que cerrar: GET y
        // DELETE no tienen nada que hacer.
        return enviarJson(res, 405, cuerpoError("method_not_allowed", "Este servidor sólo acepta POST /mcp."), { allow: "POST" });
      }

      // ── Autenticación ──
      const ip = ipDe(req);
      const cabecera = req.headers.authorization ?? "";
      const m = /^Bearer\s+(\S+)$/i.exec(cabecera);
      if (!m || !tokenValido(m[1]!, esperado)) {
        const lim = fallosPorIp.permitir(ip);
        if (!lim.ok) {
          return enviarJson(res, 429, cuerpoError("rate_limited", "Demasiados intentos fallidos. Esperá un minuto."), {
            "retry-after": String(lim.reintentarEnS),
          });
        }
        return enviarJson(res, 401, cuerpoError("unauthorized", "Falta el token o no es válido. Mandá Authorization: Bearer <token>."), {
          "www-authenticate": 'Bearer realm="encontrate-ops-mcp"',
        });
      }

      // ── Límite de pedidos ──
      const lim = porToken.permitir("token");
      if (!lim.ok) {
        return enviarJson(res, 429, cuerpoError("rate_limited", `Más de ${cfg.limitePorMinuto} pedidos por minuto. Reintentá en ${lim.reintentarEnS} s.`), {
          "retry-after": String(lim.reintentarEnS),
        });
      }

      // ── Cuerpo ──
      const leido = await leerCuerpo(req);
      if (!leido.ok) {
        return enviarJson(res, 413, cuerpoError("payload_too_large", "El pedido es demasiado grande."));
      }
      let cuerpo: unknown;
      try {
        cuerpo = JSON.parse(leido.texto);
      } catch {
        return enviarJson(res, 400, { jsonrpc: "2.0", error: { code: -32700, message: "El cuerpo no es JSON válido." }, id: null });
      }
      herramienta = nombreHerramienta(cuerpo);

      // ── MCP ──
      const server = new McpServer({ name: SERVICIO, version: VERSION }, { capabilities: { tools: {} } });
      registrar(server);
      const transporte = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
      res.on("close", () => {
        void transporte.close();
        void server.close();
      });
      await server.connect(transporte);
      await transporte.handleRequest(req, res, cuerpo);
    } catch {
      enviarJson(res, 500, { jsonrpc: "2.0", error: { code: -32603, message: "Error interno." }, id: null });
    }
  });
}
