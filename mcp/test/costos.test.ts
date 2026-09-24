import { afterEach, describe, expect, it } from "vitest";

import type { Client } from "@modelcontextprotocol/sdk/client/index.js";

import { leerConfig } from "../src/config.js";
import { crearLectorCostosMedidos, type FuenteCostos } from "../src/costos/cost-explorer.js";
import { PRECIOS } from "../src/costos/precios.js";
import { costos, type Costos } from "../src/metricas/costos.js";
import { resolverMes } from "../src/periodo.js";
import { AHORA, CFG, FILAS_NORMALES, TOKEN, clienteConectado, lectorFalso, llamar } from "./ayuda.js";

/**
 * El gasto de AWS. La base falsa devuelve números redondos (ver ayuda.ts), y
 * junio de 2026 tiene 30 días, así que cada resultado se puede hacer a mano:
 *
 *   Rekognition   1.000 texto + 1.000 caras indexadas + 50 búsquedas
 *   Caras         10.000 cara-mes                 → 0,10
 *   S3            100 GB-mes                      → 2,30
 *   Pedidos       4.000 PUT, 1.300 GET
 *   Salida        15 GB procesando + 5 GB descargas
 */

const SIN_MEDICION = { available: false as const, unavailable_reason: "test" };
const q = lectorFalso(FILAS_NORMALES);
const calcular = (mes: string | undefined, aceleracionDesde: Date | null = null, medidos = SIN_MEDICION as Parameters<typeof costos>[2]["medidos"]) =>
  q((consulta) => costos(consulta, resolverMes(mes, AHORA), { retencionDias: 30, aceleracionDesde, medidos }));

const componente = (r: Costos, item: string) => r.estimated.components.find((c) => c.item === item);

describe("la cuenta de cada componente", () => {
  it("cada renglón es cantidad por precio, y el total es la suma", async () => {
    const r = await calcular("2026-06");
    const esperado: Record<string, [number, number]> = {
      detect_text: [1000, 1],
      index_faces: [1000, 1],
      search_faces: [50, 0.05],
      face_storage: [10_000, 0.1],
      storage: [100, 2.3],
      put_requests: [4, 0.02],
      get_requests: [1.3, 0.0005],
      transfer_out_processing: [15, 1.35],
      transfer_out_downloads: [5, 0.45],
    };
    for (const [item, [cantidad, costo]] of Object.entries(esperado)) {
      const c = componente(r, item)!;
      expect(c.quantity, item).toBeCloseTo(cantidad, 3);
      expect(c.cost_usd, item).toBeCloseTo(costo, 4);
    }
    expect(r.estimated.total_usd).toBe(6.27);
  });

  it("los precios son los verificados", async () => {
    const r = await calcular("2026-06");
    expect(componente(r, "detect_text")!.unit_price_usd).toBe(PRECIOS.rekognitionTexto);
    expect(componente(r, "storage")!.unit_price_usd).toBe(0.023);
    expect(componente(r, "transfer_out_processing")!.unit_price_usd).toBe(0.09);
  });

  it("los llamados a Rekognition son contados; el resto, estimado", async () => {
    const r = await calcular("2026-06");
    for (const c of r.estimated.components) {
      const contado = ["detect_text", "index_faces", "search_faces"].includes(c.item);
      expect(c.basis, c.item).toBe(contado ? "counted" : "estimated");
    }
  });

  it("un mes pasado no se proyecta", async () => {
    const r = await calcular("2026-06");
    expect(r.estimated.projected_month_usd).toBeNull();
    expect(r.month).toMatchObject({ from: "2026-06-01", to: "2026-06-30", days_in_month: 30, days_elapsed: 30, is_current_month: false });
  });

  it("lo que no se puede saber va en not_included, no como cero", async () => {
    const r = await calcular("2026-06");
    const items = r.estimated.not_included.map((n) => n.item);
    expect(items).toEqual(expect.arrayContaining(["cloudfront", "lambda_compute", "other_project"]));
    expect(r.estimated.components.map((c) => c.item)).not.toContain("cloudfront");
  });
});

describe("Transfer Acceleration", () => {
  it("apagada: no suma renglones y lo dice", async () => {
    const r = await calcular("2026-06", null);
    expect(componente(r, "acceleration_in")).toBeUndefined();
    expect(r.estimated.not_included.map((n) => n.item)).toContain("transfer_acceleration");
  });

  it("prendida antes del mes: suma entrada a 0,08 y salida a 0,04", async () => {
    const r = await calcular("2026-06", new Date("2026-01-01T00:00:00Z"));
    expect(componente(r, "acceleration_in")).toMatchObject({ quantity: 5, cost_usd: 0.4 });
    expect(componente(r, "acceleration_out")).toMatchObject({ quantity: 6, cost_usd: 0.24 });
    expect(r.estimated.total_usd).toBe(6.91);
  });

  it("prendida después del mes: ese mes no la paga", async () => {
    const r = await calcular("2026-06", new Date("2026-07-01T00:00:00Z"));
    expect(componente(r, "acceleration_in")).toBeUndefined();
  });

  it("prendida a mitad de mes: el supuesto dice desde cuándo", async () => {
    const r = await calcular(undefined, new Date("2026-09-20T00:00:00Z"));
    expect(r.estimated.assumptions.join(" ")).toContain("desde el 2026-09-20");
  });
});

describe("proyección del mes en curso", () => {
  // AHORA es el 23/9 a las 18 UTC: van 22,75 de 30 días.
  const factor = 30 / 22.75;
  const resto = 7.25 / 30;

  it("lo que se acumula crece al ritmo; lo guardado se queda como está", async () => {
    const r = await calcular(undefined);
    const flujos = 1 + 1 + 0.05 + 0.02 + 0.00052 + 1.35 + 0.45;
    const guardado = (100 + 120 * resto) * 0.023 + (10_000 + 12_000 * resto) * 0.00001;
    expect(r.estimated.projected_month_usd).toBeCloseTo(flujos * factor + guardado, 2);
    expect(r.month).toMatchObject({ days_elapsed: 22.8, days_in_month: 30, is_current_month: true });
  });

  it("la aceleración prendida se aplica a TODO el tráfico que falta, no a su propio ritmo", async () => {
    const sin = await calcular(undefined, null);
    const con = await calcular(undefined, new Date("2026-09-20T00:00:00Z"));
    const entrada = (5 + 15 * (factor - 1)) * 0.08;
    const salida = (6 + (15 + 5) * (factor - 1)) * 0.04;
    expect(con.estimated.projected_month_usd! - sin.estimated.projected_month_usd!).toBeCloseTo(entrada + salida, 2);
  });
});

describe("comparación con lo medido", () => {
  it("dice cuánto de la cuenta es de encontrate y si Rekognition coincide", async () => {
    const r = await calcular("2026-06", null, {
      available: true,
      scope: "account",
      total_usd: 50,
      by_service: [
        { service: "Amazon Simple Storage Service", cost_usd: 30 },
        { service: "Amazon Rekognition", cost_usd: 4.3 },
      ],
      forecast_month_end_usd: null,
      age_s: 0,
      note: "test",
    });
    // Rekognition estimado: 1 + 1 + 0,05 de llamados + 0,10 de caras = 2,15.
    expect(r.comparison).toEqual({
      rekognition_estimated_usd: 2.15,
      rekognition_measured_usd: 4.3,
      rekognition_ratio: 2,
      estimated_share_of_account: 0.125,
    });
  });

  it("sin medición no hay comparación", async () => {
    const r = await calcular("2026-06");
    expect(r).not.toHaveProperty("comparison");
  });
});

describe("meses", () => {
  it("sin month, el mes en curso hasta ahora", () => {
    const m = resolverMes(undefined, AHORA);
    expect(m).toMatchObject({ esActual: true, zona: "UTC" });
    expect(m.hastaMedido).toEqual(AHORA);
    expect(m.desde.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(m.hasta.toISOString()).toBe("2026-10-01T00:00:00.000Z");
  });
  it("un mes pasado va entero", () => {
    const m = resolverMes("2026-02", AHORA);
    expect(m.esActual).toBe(false);
    expect(m.hastaMedido.toISOString()).toBe("2026-03-01T00:00:00.000Z");
    expect(m.ultimoDia).toEqual({ y: 2026, m: 2, d: 28 });
  });
  it("diciembre cierra en el año siguiente", () => {
    expect(resolverMes("2025-12", AHORA).hasta.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });
  it.each([
    ["formato roto", "2026-9"],
    ["mes 13", "2026-13"],
    ["mes futuro", "2026-10"],
    ["más de 24 meses atrás", "2024-08"],
  ])("rechaza %s", (_, mes) => {
    expect(() => resolverMes(mes, AHORA)).toThrow(/month|mes|meses/);
  });
});

describe("Cost Explorer", () => {
  type Llamada = { tipo: "costos" | "pronostico"; inicio: string; fin: string };
  function fuenteFalsa(filas: { servicio: string; usd: number }[], registro: Llamada[], resto: number | null = 20): () => Promise<FuenteCostos> {
    return async () => ({
      async costos(inicio, fin) {
        registro.push({ tipo: "costos", inicio, fin });
        return filas;
      },
      async pronostico(inicio, fin) {
        registro.push({ tipo: "pronostico", inicio, fin });
        return resto;
      },
    });
  }

  it("apagado: no consulta nada y dice qué falta", async () => {
    const registro: Llamada[] = [];
    const leer = crearLectorCostosMedidos({ activo: false, fuente: fuenteFalsa([], registro) });
    const r = await leer(resolverMes(undefined, AHORA));
    expect(r).toMatchObject({ available: false });
    expect(registro).toHaveLength(0);
  });

  it("mes en curso: días completos hasta ayer, y el pronóstico desde hoy", async () => {
    const registro: Llamada[] = [];
    const leer = crearLectorCostosMedidos({
      activo: true,
      ahora: () => AHORA,
      fuente: fuenteFalsa([{ servicio: "Amazon Rekognition", usd: 12.5 }, { servicio: "Amazon Simple Storage Service", usd: 7.5 }], registro),
    });
    const r = await leer(resolverMes(undefined, AHORA));
    expect(registro).toEqual([
      { tipo: "costos", inicio: "2026-09-01", fin: "2026-09-23" },
      { tipo: "pronostico", inicio: "2026-09-23", fin: "2026-10-01" },
    ]);
    expect(r).toMatchObject({
      available: true,
      scope: "account",
      total_usd: 20,
      forecast_month_end_usd: 40,
      by_service: [
        { service: "Amazon Rekognition", cost_usd: 12.5 },
        { service: "Amazon Simple Storage Service", cost_usd: 7.5 },
      ],
    });
  });

  it("el día 1 no hay días completos: no pide costos, sólo el pronóstico", async () => {
    const registro: Llamada[] = [];
    const dia1 = new Date("2026-09-01T10:00:00Z");
    const leer = crearLectorCostosMedidos({ activo: true, ahora: () => dia1, fuente: fuenteFalsa([], registro) });
    const r = await leer(resolverMes(undefined, dia1));
    expect(registro.map((l) => l.tipo)).toEqual(["pronostico"]);
    expect(r).toMatchObject({ total_usd: 0, forecast_month_end_usd: 20 });
  });

  it("un mes pasado va entero y sin pronóstico", async () => {
    const registro: Llamada[] = [];
    const leer = crearLectorCostosMedidos({ activo: true, ahora: () => AHORA, fuente: fuenteFalsa([], registro) });
    await leer(resolverMes("2026-06", AHORA));
    expect(registro).toEqual([{ tipo: "costos", inicio: "2026-06-01", fin: "2026-07-01" }]);
  });

  it("un nombre de servicio raro no se reenvía", async () => {
    const leer = crearLectorCostosMedidos({
      activo: true,
      ahora: () => AHORA,
      fuente: fuenteFalsa([{ servicio: "ana@example.com <b>", usd: 1 }], []),
    });
    const r = await leer(resolverMes("2026-06", AHORA));
    expect(r.available && r.by_service).toEqual([{ service: "otro servicio", cost_usd: 1 }]);
  });

  it("guarda el resultado seis horas: cada consulta cuesta un centavo", async () => {
    const registro: Llamada[] = [];
    let t = AHORA.getTime();
    const leer = crearLectorCostosMedidos({ activo: true, ahora: () => new Date(t), fuente: fuenteFalsa([], registro) });
    const mes = resolverMes("2026-06", AHORA);
    await leer(mes);
    t += 3 * 3600_000;
    const segunda = await leer(mes);
    expect(registro).toHaveLength(1);
    expect(segunda.available && segunda.age_s).toBe(3 * 3600);
    t += 4 * 3600_000;
    await leer(mes);
    expect(registro).toHaveLength(2);
  });

  it("sin permiso: dice cuál falta, y no reintenta en cada pedido", async () => {
    let llamadas = 0;
    let t = AHORA.getTime();
    const leer = crearLectorCostosMedidos({
      activo: true,
      ahora: () => new Date(t),
      fuente: async () => {
        llamadas++;
        throw Object.assign(new Error("User: arn:aws:iam::123:user/x is not authorized to perform: ce:GetCostAndUsage"), {
          name: "AccessDeniedException",
        });
      },
    });
    const mes = resolverMes("2026-06", AHORA);
    const r = await leer(mes);
    expect(r).toMatchObject({ available: false });
    expect(!r.available && r.unavailable_reason).toMatch(/ce:GetCostAndUsage/);
    // El ARN del error no se reenvía.
    expect(JSON.stringify(r)).not.toContain("arn:aws");
    await leer(mes);
    expect(llamadas).toBe(1);
    t += 6 * 60_000;
    await leer(mes);
    expect(llamadas).toBe(2);
  });

  it("Cost Explorer sin habilitar en la cuenta tiene su propio mensaje", async () => {
    const leer = crearLectorCostosMedidos({
      activo: true,
      ahora: () => AHORA,
      fuente: async () => {
        throw Object.assign(new Error("User not enabled for cost explorer access"), { name: "AccessDeniedException" });
      },
    });
    const r = await leer(resolverMes("2026-06", AHORA));
    expect(!r.available && r.unavailable_reason).toMatch(/no está habilitado/);
  });
});

describe("la herramienta, por MCP", () => {
  let cliente: Client | null = null;
  afterEach(async () => {
    await cliente?.close();
    cliente = null;
  });

  it("devuelve estimado y medido, y pasa el control de privacidad", async () => {
    cliente = await clienteConectado();
    const r = await llamar(cliente, "get_aws_costs", { month: "2026-06" });
    expect(r.esError).toBe(false);
    expect(r.json).toMatchObject({
      month: { from: "2026-06-01", timezone: "UTC" },
      estimated: { scope: "encontrate", total_usd: 6.27, price_region: "us-east-2" },
      measured: { available: false },
    });
  });

  it("un mes inválido es un error claro", async () => {
    cliente = await clienteConectado();
    const r = await llamar(cliente, "get_aws_costs", { month: "2026-10" });
    expect(r.esError).toBe(true);
    expect(r.json).toMatchObject({ error: { code: "invalid_period" } });
  });

  it("con la aceleración configurada en el servidor, la suma", async () => {
    cliente = await clienteConectado(FILAS_NORMALES, undefined, undefined, {
      ...CFG,
      aceleracionDesde: new Date("2026-01-01T00:00:00Z"),
    });
    const r = await llamar(cliente, "get_aws_costs", { month: "2026-06" });
    expect((r.json.estimated as { total_usd: number }).total_usd).toBe(6.91);
  });
});

describe("configuración de costos", () => {
  const BASE = { DATABASE_URL: "postgres://u:p@h/db", MCP_TOKEN: TOKEN };

  it.each([
    [undefined, null],
    ["false", null],
    ["true", new Date(0)],
    ["2026-09-20", new Date("2026-09-20T00:00:00Z")],
  ])("S3_TRANSFER_ACCELERATION=%s", (valor, esperado) => {
    expect(leerConfig({ ...BASE, ...(valor ? { S3_TRANSFER_ACCELERATION: valor } : {}) }).aceleracionDesde).toEqual(esperado);
  });

  it.each(["yes", "2026-02-30", "20/09/2026"])("rechaza S3_TRANSFER_ACCELERATION=%s", (valor) => {
    expect(() => leerConfig({ ...BASE, S3_TRANSFER_ACCELERATION: valor })).toThrow(/S3_TRANSFER_ACCELERATION/);
  });

  it("Cost Explorer apagado salvo que se pida", () => {
    expect(leerConfig(BASE).costExplorer).toBe(false);
    expect(leerConfig({ ...BASE, AWS_COST_EXPLORER: "true" }).costExplorer).toBe(true);
  });

  it("la retención de fotos borradas es la de la app por defecto, y se valida", () => {
    expect(leerConfig(BASE).retencionDias).toBe(30);
    expect(leerConfig({ ...BASE, PHOTO_RETENTION_DAYS: "7" }).retencionDias).toBe(7);
    expect(() => leerConfig({ ...BASE, PHOTO_RETENTION_DAYS: "0" })).toThrow(/PHOTO_RETENTION_DAYS/);
  });

  it("los enteros se leen del entorno recibido, no de process.env", () => {
    expect(leerConfig({ ...BASE, RATE_LIMIT_PER_MIN: "7" }).limitePorMinuto).toBe(7);
  });
});
