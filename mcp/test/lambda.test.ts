import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { afterEach, describe, expect, it } from "vitest";

import { FILAS_NORMALES, clienteConectado, llamar, type Filas } from "./ayuda.js";

/**
 * El estado de la Lambda de derivados en get_health: que avise cuando las
 * vistas previas caen al VPS, que es lo único que no se ve en otro número.
 * AHORA en los tests es 2026-09-23T18:00Z.
 */

let cliente: Client | null = null;
afterEach(async () => {
  await cliente?.close();
  cliente = null;
});

const conLambda = (fila: Record<string, unknown> | null): Filas => ({
  ...FILAS_NORMALES,
  lambda: fila ? [{ value: JSON.stringify(fila) }] : [],
});

async function salud(filas: Filas) {
  cliente = await clienteConectado(filas);
  const r = await llamar(cliente, "get_health");
  expect(r.esError).toBe(false);
  const fotos = r.json.photo_processing as { status: string; derivatives_lambda: Record<string, unknown> | null };
  const codigos = (r.json.alerts as { code: string }[]).map((a) => a.code);
  return { json: r.json, fotos, lambda: fotos.derivatives_lambda, codigos };
}

const BASE = {
  actualizado: "2026-09-23T17:59:30.000Z",
  pausaHasta: null,
  fallosSeguidos: 0,
  ultimoError: null,
  hora: "2026-09-23T18",
  enLambda: 40,
  enLocal: 1,
};

describe("la Lambda de derivados", () => {
  it("sin configurar: null y sin alertas", async () => {
    const { lambda, codigos, json } = await salud(conLambda(null));
    expect(lambda).toBeNull();
    expect(codigos).toEqual([]);
    expect(json.status).toBe("ok");
  });

  it("andando: active, con lo que hizo cada lado en la hora", async () => {
    const { lambda, codigos } = await salud(conLambda(BASE));
    expect(lambda).toEqual({
      status: "active",
      paused_until: null,
      last_error: null,
      in_lambda_last_hour: 40,
      in_vps_last_hour: 1,
      updated_at: "2026-09-23T17:59:30.000Z",
    });
    expect(codigos).toEqual([]);
  });

  it("en pausa: degraded, con el último error", async () => {
    const { lambda, fotos, codigos, json } = await salud(
      conLambda({ ...BASE, pausaHasta: "2026-09-23T18:04:00.000Z", fallosSeguidos: 4, ultimoError: "ResourceNotFoundException" }),
    );
    expect(lambda).toMatchObject({ status: "paused", paused_until: "2026-09-23T18:04:00.000Z", last_error: "ResourceNotFoundException" });
    expect(fotos.status).toBe("degraded");
    expect(json.status).toBe("degraded");
    expect(codigos).toEqual(["derivatives_lambda_paused"]);
    expect((json.alerts as { message: string }[])[0]!.message).toContain("ResourceNotFoundException");
  });

  it("una pausa que ya venció no cuenta", async () => {
    const { lambda, codigos } = await salud(conLambda({ ...BASE, pausaHasta: "2026-09-23T17:00:00.000Z" }));
    expect(lambda).toMatchObject({ status: "active", paused_until: null });
    expect(codigos).toEqual([]);
  });

  it("la mayoría de la hora en el VPS con la Lambda configurada: se avisa", async () => {
    const { codigos, json } = await salud(conLambda({ ...BASE, enLambda: 3, enLocal: 12, ultimoError: "TimeoutError" }));
    expect(codigos).toEqual(["derivatives_lambda_bypassed"]);
    expect((json.alerts as { message: string }[])[0]!.message).toContain("12 de 15");
  });

  it("con pocas fotos en la hora, no dice nada", async () => {
    const { codigos } = await salud(conLambda({ ...BASE, enLambda: 1, enLocal: 4 }));
    expect(codigos).toEqual([]);
  });

  it("las cuentas de otra hora no son de ahora", async () => {
    const { lambda, codigos } = await salud(conLambda({ ...BASE, hora: "2026-09-23T15", enLambda: 2, enLocal: 90 }));
    expect(lambda).toMatchObject({ in_lambda_last_hour: 0, in_vps_last_hour: 0 });
    expect(codigos).toEqual([]);
  });

  it("un error que no es un nombre (un ARN, un mensaje) sale como 'otro'", async () => {
    const { lambda, json } = await salud(
      conLambda({ ...BASE, ultimoError: "arn:aws:lambda:us-east-2:123456789012:function:x no existe" }),
    );
    expect(lambda).toMatchObject({ last_error: "otro" });
    expect(JSON.stringify(json)).not.toContain("123456789012");
  });

  it.each(["no es json", "null", "[]", "123", '"texto"'])("una fila rota (%s) no rompe la salud", async (valor) => {
    cliente = await clienteConectado({ ...FILAS_NORMALES, lambda: [{ value: valor }] });
    const r = await llamar(cliente, "get_health");
    expect(r.esError).toBe(false);
    expect((r.json.photo_processing as { derivatives_lambda: unknown }).derivatives_lambda).toBeNull();
  });

  it("una fila de hace más de un día: la Lambda no está configurada o no hizo nada, null", async () => {
    const { lambda, codigos } = await salud(
      conLambda({ ...BASE, actualizado: "2026-09-21T10:00:00.000Z", pausaHasta: "2026-09-24T00:00:00.000Z" }),
    );
    expect(lambda).toBeNull();
    expect(codigos).toEqual([]);
  });
});
