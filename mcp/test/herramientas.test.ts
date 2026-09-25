import { afterEach, describe, expect, it } from "vitest";

import type { Client } from "@modelcontextprotocol/sdk/client/index.js";

import { CLAVES_PERMITIDAS } from "../src/privacidad.js";
import { FILAS_NORMALES, clienteConectado, llamar, todasLasClaves, todosLosTextos, type Filas } from "./ayuda.js";

/**
 * Cada herramienta, llamada con un cliente MCP de verdad contra una base
 * falsa. Lo que se prueba es lo que ve el agente: la forma de la respuesta, y
 * que en ninguna parte aparezca un dato personal.
 */

let cliente: Client | null = null;
afterEach(async () => {
  await cliente?.close();
  cliente = null;
});

const LLAMADAS: [string, Record<string, unknown>][] = [
  ["ping", {}],
  ["get_health", {}],
  ["get_activation", { period: "last_30d" }],
  ["get_usage", { period: "last_7d" }],
  ["get_sales", { period: "today" }],
  ["get_weekly_snapshot", {}],
  ["get_weekly_snapshot", { include_previous_week: false }],
  ["get_aws_costs", {}],
  ["get_aws_costs", { month: "2026-08" }],
];

const CLAVES_PII = /email|name|phone|user_?id|owner|seller|buyer|visitor|photo_?id|photo_?ids|^id$|url|slug|key|token|ip$|embedding|face_?id|bib|last4|password|address/i;

describe("ninguna respuesta tiene datos personales", () => {
  it.each(LLAMADAS)("%s %j", async (nombre, args) => {
    cliente = await clienteConectado();
    const r = await llamar(cliente, nombre, args);
    expect(r.esError).toBe(false);

    const claves = todasLasClaves(r.json);
    for (const c of claves) {
      expect(CLAVES_PERMITIDAS.has(c), `clave no permitida: ${c}`).toBe(true);
      expect(c, `clave con forma de dato personal: ${c}`).not.toMatch(CLAVES_PII);
    }
    for (const t of todosLosTextos(r.json)) {
      expect(t).not.toMatch(/@|https?:\/\/|\bc[a-z0-9]{24}\b|[0-9a-f]{8}-[0-9a-f]{4}-/i);
    }
    // El contenido estructurado y el texto dicen lo mismo.
    expect(r.estructurado).toEqual(r.json);
  });
});

describe("si una consulta trae algo que no debería, la respuesta no sale", () => {
  it("una moneda con forma de mail se reemplaza, no se manda", async () => {
    cliente = await clienteConectado({
      ...FILAS_NORMALES,
      ventas: [{ moneda: "ana@example.com", pagadas: 9, bruto_centavos: "900000", fallidas: 0, regalos: 0 }],
    });
    const r = await llamar(cliente, "get_sales", { period: "last_7d" });
    expect(r.esError).toBe(false);
    expect(JSON.stringify(r.json)).not.toContain("example.com");
    expect((r.json.purchases_gross as { currency: string }[])[0]!.currency).toBe("XXX");
  });

  it("un código de error desconocido sale como 'otro', nunca con su texto", async () => {
    cliente = await clienteConectado({
      ...FILAS_NORMALES,
      errores: [{ clase: "cuervito/users/cmpbscf930000l400wrmr5rp7/original/x.jpg", n: 3 }],
    });
    const r = await llamar(cliente, "get_health");
    expect(r.esError).toBe(false);
    expect(r.json.errors).toEqual([{ source: "photo_processing", code: "otro", count: 3 }]);
  });

  it("los tiempos del procesador traen el id de cada foto, y no sale", async () => {
    const filas = Array.from({ length: 5 }, (_, i) => ({
      foto: `00d86a36-2570-4631-9e51-1169b17757${i}d`,
      cuando: "2026-09-23T17:30:00.000Z",
      total: 12_000 + i * 500,
      etapas: { descarga: 8_000 + i * 100 },
      final: "ok",
    }));
    cliente = await clienteConectado({ ...FILAS_NORMALES, tiempos: [{ value: JSON.stringify(filas) }] });
    const r = await llamar(cliente, "get_health");
    expect(JSON.stringify(r.json)).not.toContain("00d86a36");
    expect((r.json.photo_processing as { timings: unknown }).timings).toEqual({
      samples: 5,
      median_total_ms: 13_000,
      p90_total_ms: 14_000,
      median_download_ms: 8_200,
    });
  });
});

describe("el control de privacidad está conectado a la salida", () => {
  /* Las pruebas de arriba pasan aunque el control esté apagado: las consultas
     son agregados y no traen datos personales. Éstas meten uno por el único
     camino que no pasa por la limpieza de cada métrica —las alarmas, que se
     inyectan— para probar que la respuesta igual no sale. Si alguien borra la
     llamada a verificarSalida, fallan acá. */

  it("un mail que llega a la respuesta la corta con privacy_violation", async () => {
    cliente = await clienteConectado(FILAS_NORMALES, {
      available: true,
      alarms_in_alarm: 1,
      alarms: [{ alarm: "ana@example.com", updated_at: null }],
    });
    const r = await llamar(cliente, "get_health");
    expect(r.esError).toBe(true);
    expect((r.json.error as { code: string }).code).toBe("privacy_violation");
    expect(JSON.stringify(r.json)).not.toContain("ana@example.com");
  });

  it("una clave que no está permitida corta la respuesta", async () => {
    cliente = await clienteConectado(FILAS_NORMALES, {
      available: true,
      alarms_in_alarm: 1,
      alarms: [{ alarm: "ok", updated_at: null, buyerEmail: "x" } as never],
    });
    const r = await llamar(cliente, "get_health");
    expect(r.esError).toBe(true);
    expect((r.json.error as { code: string; message: string }).message).toContain("buyerEmail");
  });
});

describe("las métricas que no existen salen en null, con la razón", () => {
  it("dorsal_searches", async () => {
    cliente = await clienteConectado();
    const r = await llamar(cliente, "get_usage", { period: "last_7d" });
    expect(r.json.dorsal_searches).toBeNull();
    expect((r.json.unavailable_reason as Record<string, string>).dorsal_searches).toMatch(/dorsal/);
  });

  it("payments_rejected", async () => {
    cliente = await clienteConectado();
    const r = await llamar(cliente, "get_sales", { period: "last_7d" });
    expect(r.json.payments_rejected).toBeNull();
    expect((r.json.unavailable_reason as Record<string, string>).payments_rejected).toMatch(/FAILED/);
  });

  it("CloudWatch sin configurar", async () => {
    cliente = await clienteConectado();
    const r = await llamar(cliente, "get_health");
    expect(r.json.aws).toMatchObject({ available: false });
  });
});

describe("ventas", () => {
  it("con menos de 5 compras, el total no se informa", async () => {
    cliente = await clienteConectado({
      ...FILAS_NORMALES,
      ventas: [{ moneda: "ARS", pagadas: 1, bruto_centavos: "300000", fallidas: 0, regalos: 0 }],
    });
    const r = await llamar(cliente, "get_sales", { period: "today" });
    expect(r.json.purchases_count).toBe(1);
    expect(r.json.purchases_gross).toEqual([{ currency: "ARS", amount: null, suppressed: true }]);
    expect(JSON.stringify(r.json)).not.toContain("3000");
    expect((r.json.unavailable_reason as Record<string, string>).purchases_gross).toMatch(/menos de 5/);
  });

  it("con 5 o más, el total va en unidades, no en centavos", async () => {
    cliente = await clienteConectado();
    const r = await llamar(cliente, "get_sales", { period: "last_7d" });
    expect(r.json.purchases_gross).toEqual([{ currency: "ARS", amount: 171_000, suppressed: false }]);
    expect(r.json.failure_rate).toBe(0.0339); // 2 / (57 + 2)
  });

  it("sin compras, no hay total que mostrar", async () => {
    cliente = await clienteConectado({ ...FILAS_NORMALES, ventas: [] });
    const r = await llamar(cliente, "get_sales", { period: "today" });
    expect(r.json).toMatchObject({ purchases_count: 0, purchases_gross: [], failure_rate: null });
  });
});

describe("estado de salud", () => {
  const conFotos = (f: Partial<Record<string, number | null>>): Filas => ({
    ...FILAS_NORMALES,
    fotos: [{ ...(FILAS_NORMALES.fotos![0] as object), ...f }],
  });

  it("sin nada pendiente, ok aunque haga días que no se procesa nada", async () => {
    cliente = await clienteConectado(conFotos({ edad_ultimo_exito_s: 300_000 }));
    const r = await llamar(cliente, "get_health");
    expect(r.json.status).toBe("ok");
    expect(r.json.alerts).toEqual([]);
  });

  it("fotos libres hace más de 15 min y la cola sin hacer nada en media hora: down, con alerta crítica", async () => {
    // Y el reconocimiento también quieto: su actividad cuenta como de la cola.
    cliente = await clienteConectado({
      ...conFotos({ pendientes: 40, libres: 40, libres_15m: 40, edad_ultimo_exito_s: 3_600, edad_actividad_s: 3_600 }),
      reconocimiento: [{ ...(FILAS_NORMALES.reconocimiento![0] as object), edad_ultimo_s: 3_600 }],
    });
    const r = await llamar(cliente, "get_health");
    expect((r.json.photo_processing as { status: string }).status).toBe("down");
    expect(r.json.alerts).toContainEqual(expect.objectContaining({ severity: "critical", code: "processing_stalled" }));
  });

  it("sólo fotos apartadas y la cola ociosa: degraded, no down", async () => {
    // El caso real que motivó separar trabajables de apartadas.
    cliente = await clienteConectado(
      conFotos({ pendientes: 10, pendientes_1h: 10, apartadas: 10, trabajables_1h: 0, edad_ultimo_exito_s: 250_000, edad_actividad_s: 250_000 }),
    );
    const r = await llamar(cliente, "get_health");
    expect((r.json.photo_processing as { status: string }).status).toBe("degraded");
    const codigos = (r.json.alerts as { code: string }[]).map((a) => a.code);
    expect(codigos).toEqual(["photos_parked"]);
  });

  it("descargas lentas desde S3: degraded", async () => {
    const lentas = Array.from({ length: 4 }, () => ({ cuando: "2026-09-23T17:30:00.000Z", total: 240_000, etapas: { descarga: 200_000 } }));
    cliente = await clienteConectado({ ...FILAS_NORMALES, tiempos: [{ value: JSON.stringify(lentas) }] });
    const r = await llamar(cliente, "get_health");
    expect(r.json.alerts).toContainEqual(expect.objectContaining({ code: "slow_storage_downloads" }));
  });

  it("la mitad de los pagos fallando: down", async () => {
    cliente = await clienteConectado({ ...FILAS_NORMALES, pagos: [{ pagadas: 5, fallidas: 5, sin_confirmar: 0, abandonadas: 0 }] });
    const r = await llamar(cliente, "get_health");
    expect((r.json.payments as { status: string }).status).toBe("down");
    expect(r.json.status).toBe("down");
  });

  it("pocos pagos: no hay tasa que alarme", async () => {
    cliente = await clienteConectado({ ...FILAS_NORMALES, pagos: [{ pagadas: 1, fallidas: 1, sin_confirmar: 0, abandonadas: 0 }] });
    const r = await llamar(cliente, "get_health");
    expect((r.json.payments as { status: string }).status).toBe("ok");
  });

  it("checkouts abandonados de días atrás no son una alerta", async () => {
    cliente = await clienteConectado({ ...FILAS_NORMALES, pagos: [{ pagadas: 3, fallidas: 0, sin_confirmar: 0, abandonadas: 60 }] });
    const r = await llamar(cliente, "get_health");
    expect(r.json.alerts).toEqual([]);
  });

  it("alarmas de CloudWatch sonando: degraded", async () => {
    cliente = await clienteConectado(FILAS_NORMALES, {
      available: true,
      alarms_in_alarm: 1,
      alarms: [{ alarm: "encontrate-5xx", updated_at: "2026-09-23T17:00:00.000Z" }],
    });
    const r = await llamar(cliente, "get_health");
    expect(r.json.status).toBe("degraded");
    expect(r.json.alerts).toContainEqual(expect.objectContaining({ code: "cloudwatch_alarms" }));
  });
});

describe("snapshot semanal", () => {
  it("trae la semana anterior y los deltas", async () => {
    cliente = await clienteConectado();
    const r = await llamar(cliente, "get_weekly_snapshot", {});
    expect(r.json.week).toMatchObject({ from: "2026-09-14", to: "2026-09-20" });
    expect(r.json.previous_week).toMatchObject({ week: { from: "2026-09-07", to: "2026-09-13" } });
    // La base falsa devuelve lo mismo para las dos semanas.
    expect((r.json.deltas as Record<string, unknown>).photos_uploaded).toEqual({
      current: 2400,
      previous: 2400,
      change: 0,
      change_pct: 0,
    });
    expect(r.json.health_now).toMatchObject({ status: "ok", alerts_count: 0 });
  });

  it("sin la semana anterior, no hay deltas", async () => {
    cliente = await clienteConectado();
    const r = await llamar(cliente, "get_weekly_snapshot", { include_previous_week: false });
    expect(r.json).not.toHaveProperty("previous_week");
    expect(r.json).not.toHaveProperty("deltas");
  });
});

describe("errores", () => {
  it("un período inválido es un error claro en JSON, no una excepción", async () => {
    cliente = await clienteConectado();
    const r = await llamar(cliente, "get_sales", { period: "custom", from: "2026-09-10", to: "2026-09-01" });
    expect(r.esError).toBe(true);
    expect(r.json).toEqual({ error: { code: "invalid_period", message: "from no puede ser posterior a to." } });
  });

  it("un error de la base no filtra su mensaje", async () => {
    const { McpServer } = await import("@modelcontextprotocol/sdk/server/mcp.js");
    const { InMemoryTransport } = await import("@modelcontextprotocol/sdk/inMemory.js");
    const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
    const { registrarHerramientas } = await import("../src/herramientas.js");
    const { CFG, AHORA } = await import("./ayuda.js");

    const server = new McpServer({ name: "t", version: "0" });
    registrarHerramientas(server, {
      cfg: CFG,
      ahora: () => AHORA,
      alarmas: async () => ({ available: false, unavailable_reason: "x" }),
      lector: async () => {
        throw Object.assign(new Error('relation "Sale" permission denied for column buyerEmail = ana@example.com'), { code: "42501" });
      },
    });
    const [a, b] = InMemoryTransport.createLinkedPair();
    const c = new Client({ name: "t", version: "0" });
    await Promise.all([server.connect(a), c.connect(b)]);
    const r = await llamar(c, "get_sales", {});
    await c.close();

    expect(r.esError).toBe(true);
    expect(r.json).toEqual({ error: { code: "internal", message: "Error interno al calcular la métrica." } });
    expect(JSON.stringify(r.json)).not.toContain("ana@example.com");
  });

  it("un timeout de la base se informa como tal", async () => {
    const { McpServer } = await import("@modelcontextprotocol/sdk/server/mcp.js");
    const { InMemoryTransport } = await import("@modelcontextprotocol/sdk/inMemory.js");
    const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
    const { registrarHerramientas } = await import("../src/herramientas.js");
    const { CFG, AHORA } = await import("./ayuda.js");

    const server = new McpServer({ name: "t", version: "0" });
    registrarHerramientas(server, {
      cfg: CFG,
      ahora: () => AHORA,
      alarmas: async () => ({ available: false, unavailable_reason: "x" }),
      lector: async () => {
        throw Object.assign(new Error("canceling statement due to statement timeout"), { code: "57014" });
      },
    });
    const [a, b] = InMemoryTransport.createLinkedPair();
    const c = new Client({ name: "t", version: "0" });
    await Promise.all([server.connect(a), c.connect(b)]);
    const r = await llamar(c, "get_usage", {});
    await c.close();
    expect((r.json.error as { code: string }).code).toBe("db_timeout");
  });
});

describe("las herramientas se anuncian como de sólo lectura", () => {
  it("todas, y ninguna más que las siete", async () => {
    cliente = await clienteConectado();
    const { tools } = await cliente.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(
      ["get_activation", "get_aws_costs", "get_health", "get_sales", "get_usage", "get_weekly_snapshot", "ping"],
    );
    for (const t of tools) {
      expect(t.annotations, t.name).toMatchObject({ readOnlyHint: true, destructiveHint: false });
    }
  });
});
