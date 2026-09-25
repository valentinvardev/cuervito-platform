import { existsSync, readFileSync } from "node:fs";

import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { afterEach, describe, expect, it } from "vitest";

import {
  ESPERAS_LENTAS_H,
  ESPERA_RAPIDA_MIN,
  HORAS_ETAPA_LENTA,
  INTENTOS_RAPIDOS,
  LEASE_MIN,
  MAX_INTENTOS,
  TOPE_MIN,
} from "../src/metricas/cola.js";
import { leerFreno } from "../src/metricas/reconocimiento.js";
import { AHORA, FILAS_NORMALES, clienteConectado, llamar, type Filas } from "./ayuda.js";

/**
 * El bloque `recognition` de get_health: que avise de las fotos que se ven
 * pero no se encuentran, sin gritar por lo que es normal.
 */

let cliente: Client | null = null;
afterEach(async () => {
  await cliente?.close();
  cliente = null;
});

type Fila = Record<string, number | null>;
const conRek = (r: Fila, fotos: Fila = {}, extra: Filas = {}): Filas => ({
  ...FILAS_NORMALES,
  reconocimiento: [{ ...(FILAS_NORMALES.reconocimiento![0] as object), ...r }],
  fotos: [{ ...(FILAS_NORMALES.fotos![0] as object), ...fotos }],
  ...extra,
});

async function salud(filas: Filas) {
  cliente = await clienteConectado(filas);
  const r = await llamar(cliente, "get_health");
  expect(r.esError).toBe(false);
  const rek = r.json.recognition as Record<string, unknown>;
  const codigos = (r.json.alerts as { code: string }[]).map((a) => a.code);
  return { json: r.json, rek, codigos };
}

const FRENO_PUESTO = { value: JSON.stringify({ hasta: "2026-09-23T18:20:00.000Z", fallos: 10 }) };

describe("reconocimiento", () => {
  it("todo reconocido: ok, sin alertas, con los números a la vista", async () => {
    const { json, rek, codigos } = await salud(FILAS_NORMALES);
    expect(json.status).toBe("ok");
    expect(codigos).toEqual([]);
    expect(rek).toEqual({
      status: "ok",
      missing: 0,
      queued: 0,
      queued_over_3h: 0,
      in_flight: 0,
      retrying: 0,
      retrying_slowly: 0,
      waiting_quota: 0,
      parked_after_retries: 0,
      rejected_by_rekognition: 0,
      paused_until: null,
      last_recognition_age_s: 120,
      recognized_last_7d: 500,
      without_faces_last_7d: 40,
      no_faces_share_last_7d: 0.08,
      recognition_off_events: 0,
      recognition_off_photos: 0,
    });
  });

  it("la cola se rindió con algunas: degraded, y dice cuántos intentos fueron", async () => {
    const { json, codigos } = await salud(conRek({ faltan: 7, apartadas: 7 }));
    expect(json.status).toBe("degraded");
    expect(codigos).toEqual(["recognition_parked"]);
    expect((json.alerts as { message: string }[])[0]!.message).toContain(`${MAX_INTENTOS} veces`);
  });

  it("reintentos lentos: degraded con recognition_retrying", async () => {
    const { json, codigos } = await salud(conRek({ faltan: 3, reintentando: 3, reintentando_despacio: 3, edad_ultimo_s: 90_000 }));
    expect(json.status).toBe("degraded");
    expect(codigos).toEqual(["recognition_retrying"]);
  });

  it("un fallo suelto en la etapa rápida no es una alerta", async () => {
    const { json, codigos } = await salud(conRek({ faltan: 1, reintentando: 1, reintentando_despacio: 0 }));
    expect(json.status).toBe("ok");
    expect(codigos).toEqual([]);
  });

  it("una sola foto reintentando de madrugada, sin nada más que reconocer: degraded, no down", async () => {
    // El caso que un umbral por edad sola haría saltar: nada se reconoció en
    // horas porque no había nada para reconocer.
    const { rek, codigos } = await salud(conRek({ faltan: 1, reintentando: 1, reintentando_despacio: 1, edad_ultimo_s: 40_000 }));
    expect(rek.status).toBe("degraded");
    expect(codigos).toEqual(["recognition_retrying"]);
  });

  it("fotos libres hace más de 15 min y nada reconocido en media hora: down", async () => {
    const { json, rek, codigos } = await salud(conRek({ faltan: 30, en_cola: 30, en_cola_15m: 30, edad_ultimo_s: 7_200 }));
    expect(rek.status).toBe("down");
    expect(json.status).toBe("down");
    expect(codigos).toEqual(["recognition_stalled"]);
    expect((json.alerts as { severity: string }[])[0]!.severity).toBe("critical");
  });

  it("una unidad colgada también es un atasco", async () => {
    const { codigos } = await salud(conRek({ faltan: 1, en_vuelo: 1, colgadas: 1, edad_ultimo_s: 7_200 }));
    expect(codigos).toEqual(["recognition_stalled"]);
  });

  it("fotos que se liberaron recién, con la cola dormida: no es un atasco", async () => {
    const { rek, codigos } = await salud(conRek({ faltan: 2, en_cola: 2, en_cola_15m: 0, edad_ultimo_s: 40_000 }));
    expect(rek.status).toBe("ok");
    expect(codigos).toEqual([]);
  });

  it("con vistas previas pendientes, que el reconocimiento espere es lo normal", async () => {
    const { rek, codigos } = await salud(
      conRek(
        { faltan: 300, en_cola: 300, en_cola_15m: 300, en_cola_3h: 100, edad_ultimo_s: 15_000 },
        { pendientes: 200, libres: 198, en_vuelo: 2, edad_ultimo_exito_s: 20, edad_actividad_s: 20 },
      ),
    );
    expect(rek.status).toBe("ok");
    expect(rek.queued_over_3h).toBe(100);
    expect(codigos).toEqual([]);
  });

  it("nunca se reconoció nada y hay fotos esperando: down", async () => {
    const { codigos, json } = await salud(conRek({ faltan: 5, en_cola: 5, en_cola_15m: 5, edad_ultimo_s: null }));
    expect(codigos).toEqual(["recognition_stalled"]);
    expect((json.alerts as { message: string }[])[0]!.message).toContain("nunca");
  });

  it("muchas fallando recién y ninguna reconocida: down con recognition_failing", async () => {
    const { rek, codigos } = await salud(conRek({ faltan: 12, reintentando: 12, reintentando_despacio: 0, fallaron_2h: 12, edad_ultimo_s: 3_600 }));
    expect(rek.status).toBe("down");
    expect(codigos).toEqual(["recognition_failing"]);
  });

  it("muchas en los reintentos lentos en una semana tranquila: degraded, no down", async () => {
    // Después de una falla ya arreglada, las fotos esperan su próximo intento
    // lento durante horas. Eso no es una caída.
    const { rek, codigos } = await salud(conRek({ faltan: 12, reintentando: 12, reintentando_despacio: 12, fallaron_2h: 0, edad_ultimo_s: 40_000 }));
    expect(rek.status).toBe("degraded");
    expect(codigos).toEqual(["recognition_retrying"]);
  });

  it("muchas en la etapa lenta que fallaron en las últimas dos horas: la falla sigue, down", async () => {
    const { rek, codigos } = await salud(conRek({ faltan: 30, reintentando: 30, reintentando_despacio: 30, fallaron_2h: 30, edad_ultimo_s: 7_200 }));
    expect(rek.status).toBe("down");
    expect(codigos).toEqual(["recognition_failing", "recognition_retrying"]);
  });

  it("el freno de la cola puesto: down, con hasta cuándo", async () => {
    const { rek, codigos, json } = await salud(conRek({ faltan: 40, en_cola: 40, en_cola_15m: 40, edad_ultimo_s: 3_600 }, {}, { freno: [FRENO_PUESTO] }));
    expect(rek.status).toBe("down");
    expect(rek.paused_until).toBe("2026-09-23T18:20:00.000Z");
    // El freno explica el atasco: no se suma una segunda alerta crítica por lo mismo.
    expect(codigos).toEqual(["recognition_paused"]);
    expect((json.alerts as { message: string }[])[0]!.message).toMatch(/credenciales|permisos/);
  });

  it("un freno que venció hace rato no cuenta", async () => {
    const vencido = { value: JSON.stringify({ hasta: "2026-09-23T17:00:00.000Z", fallos: 10 }) };
    const { rek, codigos } = await salud(conRek({}, {}, { freno: [vencido] }));
    expect(rek.paused_until).toBeNull();
    expect(codigos).toEqual([]);
  });

  it("recién vencido el freno, con la cola por despertarse: ni pausa ni atasco", async () => {
    // AHORA es 18:00; el freno venció a las 17:55.
    const recien = { value: JSON.stringify({ hasta: "2026-09-23T17:55:00.000Z", fallos: 10 }) };
    const { rek, codigos } = await salud(
      conRek({ faltan: 30, en_cola: 30, en_cola_15m: 30, edad_ultimo_s: 3_600 }, {}, { freno: [recien] }),
    );
    expect(rek.paused_until).toBeNull();
    expect(codigos).toEqual([]);
  });

  it.each([
    ["con fecha cero", "1970-01-01T00:00:00.000Z"],
    ["aunque tuviera una fecha reciente", "2026-09-23T17:55:00.000Z"],
  ])("el freno que la app borra al arrancar no tapa un atasco (%s)", async (_, hasta) => {
    const borrado = { value: JSON.stringify({ hasta, fallos: 0 }) };
    const { rek, codigos } = await salud(
      conRek({ faltan: 30, en_cola: 30, en_cola_15m: 30, edad_ultimo_s: 10_800 }, {}, { freno: [borrado] }),
    );
    expect(rek.paused_until).toBeNull();
    expect(codigos).toEqual(["recognition_stalled"]);
  });

  it("tope de gasto alcanzado: degraded, y dice que es el cortacircuitos, no la cuota del panel", async () => {
    const { json, rek, codigos } = await salud(conRek({ faltan: 40, esperando_cuota: 40 }));
    expect(codigos).toEqual(["recognition_waiting_quota"]);
    expect(rek.status).toBe("degraded");
    expect(json.status).toBe("degraded");
    expect((json.alerts as { message: string }[])[0]!.message).toMatch(/RECOGNITION_HARD_CAP_MONTHLY/);
  });

  it("fotos que Rekognition rechazó en la semana: recognition_rejected", async () => {
    const { rek, codigos } = await salud(conRek({ rechazadas: 5, rechazadas_7d: 2 }));
    expect(rek.rejected_by_rekognition).toBe(5);
    expect(codigos).toEqual(["recognition_rejected"]);
  });

  it("rechazos viejos se informan pero ya no alertan", async () => {
    const { rek, codigos } = await salud(conRek({ rechazadas: 5, rechazadas_7d: 0 }));
    expect(rek.rejected_by_rekognition).toBe(5);
    expect(codigos).toEqual([]);
  });

  it("más de un 30 % sin caras en 7 días: recognition_no_faces", async () => {
    const { codigos } = await salud(conRek({ reconocidas_7d: 300, sin_caras_7d: 100 }));
    expect(codigos).toEqual(["recognition_no_faces"]);
  });

  it("un 22 %, el peor evento que hubo, no alerta", async () => {
    const { codigos } = await salud(conRek({ reconocidas_7d: 300, sin_caras_7d: 66 }));
    expect(codigos).toEqual([]);
  });

  it("con una muestra chica, una proporción alta no dice nada", async () => {
    const { codigos } = await salud(conRek({ reconocidas_7d: 40, sin_caras_7d: 30 }));
    expect(codigos).toEqual([]);
  });

  it("eventos con el reconocimiento apagado: se informa, no se alerta", async () => {
    const { json, rek, codigos } = await salud(conRek({ apagado_fotos: 126, apagado_eventos: 1 }));
    expect(json.status).toBe("ok");
    expect(codigos).toEqual([]);
    expect(rek).toMatchObject({ recognition_off_events: 1, recognition_off_photos: 126 });
  });

  it("los errores de reconocimiento salen por clase, y una clase rara como 'otro'", async () => {
    const { json } = await salud(
      conRek({ faltan: 5, reintentando: 5 }, {}, {
        erroresRek: [{ clase: "tope", n: 3 }, { clase: "reinicio", n: 1 }, { clase: "cuervito/users/x/original/y.jpg", n: 2 }],
      }),
    );
    expect(json.errors).toEqual(
      expect.arrayContaining([
        { source: "recognition", code: "tope", count: 3 },
        { source: "recognition", code: "reinicio", count: 1 },
        { source: "recognition", code: "otro", count: 2 },
      ]),
    );
    expect(JSON.stringify(json)).not.toContain("original/");
  });

  it("el resumen de la semana trae el estado del reconocimiento", async () => {
    cliente = await clienteConectado(conRek({ faltan: 7, apartadas: 7 }));
    const r = await llamar(cliente, "get_weekly_snapshot", { include_previous_week: false });
    expect(r.json.health_now).toMatchObject({ recognition: "degraded", status: "degraded" });
  });
});

describe("si el reconocimiento no se puede leer", () => {
  /* El rol de sólo lectura del README tiene permisos por columna. Si le faltan
     los del reconocimiento, o la consulta se pasa del tope de tiempo, esa
     parte falla; lo demás tiene que seguir. El lector de acá hace lo que hace
     Postgres: después de un error, la transacción queda abortada y todo falla
     hasta volver al savepoint. */
  async function conFalla(codigo: string | undefined) {
    const { lectorFalso, CFG } = await import("./ayuda.js");
    const { McpServer } = await import("@modelcontextprotocol/sdk/server/mcp.js");
    const { InMemoryTransport } = await import("@modelcontextprotocol/sdk/inMemory.js");
    const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
    const { registrarHerramientas } = await import("../src/herramientas.js");
    const { SQL_RECONOCIMIENTO } = await import("../src/metricas/reconocimiento.js");
    const base = lectorFalso(conRek({ faltan: 3 }));

    const server = new McpServer({ name: "test", version: "0" });
    registrarHerramientas(server, {
      lector: (trabajo) =>
        base((q) => {
          let abortada = false;
          return trabajo(async (sql, params) => {
            if (/^rollback to savepoint /i.test(sql)) {
              abortada = false;
              return [];
            }
            if (abortada) throw new Error("current transaction is aborted, commands ignored until end of transaction block");
            if (sql === SQL_RECONOCIMIENTO) {
              abortada = true;
              throw Object.assign(new Error('permission denied for column "faceProcessedAt"'), { code: codigo });
            }
            return q(sql, params);
          });
        }),
      cfg: CFG,
      ahora: () => AHORA,
      alarmas: async () => ({ available: false, unavailable_reason: "test" }),
      costosMedidos: async () => ({ available: false, unavailable_reason: "test" }),
    });
    const [a, b] = InMemoryTransport.createLinkedPair();
    const c = new Client({ name: "t", version: "0" });
    await Promise.all([server.connect(a), c.connect(b)]);
    cliente = c;
    return c;
  }

  it("get_health: recognition en null, alerta, degraded, y el resto de la salud igual", async () => {
    const c = await conFalla("42501");
    const r = await llamar(c, "get_health");
    expect(r.esError).toBe(false);
    expect(r.json.recognition).toBeNull();
    expect(r.json.status).toBe("degraded");
    expect((r.json.alerts as { code: string }[]).map((x) => x.code)).toEqual(["recognition_unavailable"]);
    expect((r.json.unavailable_reason as { recognition: string }).recognition).toMatch(/permisos/);
    expect(r.json.photo_processing).toMatchObject({ status: "ok" });
    expect(JSON.stringify(r.json)).not.toContain("faceProcessedAt");
  });

  it("la razón sale del código de Postgres, no del texto", async () => {
    const c = await conFalla("57014");
    const r = await llamar(c, "get_health");
    expect((r.json.unavailable_reason as { recognition: string }).recognition).toMatch(/tope de tiempo/);
  });

  it("get_weekly_snapshot con la semana anterior sigue funcionando después de la falla", async () => {
    // salud() corre antes que la semana anterior en la misma transacción: sin
    // el savepoint, todo lo que viene después fallaba.
    const c = await conFalla("42501");
    const r = await llamar(c, "get_weekly_snapshot", {});
    expect(r.esError).toBe(false);
    expect(r.json.previous_week).toBeDefined();
    expect(r.json.health_now).toMatchObject({ recognition: null, status: "degraded" });
  });
});

describe("vistas previas con los reintentos nuevos", () => {
  it("reintentando despacio: photos_retrying, degraded", async () => {
    const { json, codigos } = await salud(
      conRek({}, { pendientes: 4, reintentando: 4, reintentando_despacio: 4, edad_ultimo_exito_s: 90_000 }),
    );
    expect((json.photo_processing as { retrying_slowly: number }).retrying_slowly).toBe(4);
    expect(json.status).toBe("degraded");
    expect(codigos).toEqual(["photos_retrying"]);
  });

  it("una foto que se liberó recién, con la cola dormida y días sin actividad: no es down", async () => {
    const { json, codigos } = await salud(
      conRek({ edad_ultimo_s: 300_000 }, { pendientes: 1, libres: 1, libres_15m: 0, edad_ultimo_exito_s: 300_000 }),
    );
    expect((json.photo_processing as { status: string }).status).toBe("ok");
    expect(codigos).toEqual([]);
  });

  it("una unidad colgada, sin actividad en media hora: processing_stalled", async () => {
    const { codigos } = await salud(
      conRek({ edad_ultimo_s: 3_000 }, { pendientes: 1, en_vuelo: 1, colgadas: 1, edad_ultimo_exito_s: 3_000 }),
    );
    expect(codigos).toContain("processing_stalled");
  });

  it("una falla como la del 16 al 20/9: todo se corta en el tope y la cola sigue reclamando, down", async () => {
    // Las unidades en vuelo no cuentan como actividad: la cola reclama sin
    // parar y no termina nada.
    const { json, codigos } = await salud(
      conRek(
        { edad_ultimo_s: 7_200 },
        { pendientes: 200, libres: 190, libres_15m: 190, en_vuelo: 2, reintentando: 1, fallaron_2h: 1, trabajables_1h: 150, ultima_hora: 0, edad_ultimo_exito_s: 7_200 },
      ),
    );
    expect((json.photo_processing as { status: string }).status).toBe("down");
    expect(codigos).toContain("processing_stalled");
  });

  it("muchas fallando recién y ninguna terminada: processing_failing", async () => {
    const { codigos } = await salud(
      conRek({}, { pendientes: 20, reintentando: 20, fallaron_2h: 20, edad_ultimo_exito_s: 3_600 }),
    );
    expect(codigos).toContain("processing_failing");
  });

  it("muchas en los reintentos lentos en una semana tranquila: degraded, no down", async () => {
    const { json, codigos } = await salud(
      conRek({}, { pendientes: 12, reintentando: 12, reintentando_despacio: 12, fallaron_2h: 0, edad_ultimo_exito_s: 40_000 }),
    );
    expect((json.photo_processing as { status: string }).status).toBe("degraded");
    expect(codigos).toEqual(["photos_retrying"]);
  });

  it("la actividad del reconocimiento cuenta como actividad de la cola", async () => {
    // edad_actividad_s de las vistas previas es vieja, pero el reconocimiento
    // trabajó hace un minuto: la cola está viva.
    const { json } = await salud(
      conRek({ edad_ultimo_s: 60 }, { pendientes: 5, libres: 5, libres_15m: 5, edad_ultimo_exito_s: 5_000 }),
    );
    expect((json.photo_processing as { status: string }).status).toBe("ok");
  });

  it("las apartadas dicen cuántos intentos fueron", async () => {
    const { json } = await salud(conRek({}, { pendientes: 2, pendientes_1h: 2, apartadas: 2 }));
    const a = (json.alerts as { code: string; message: string }[]).find((x) => x.code === "photos_parked")!;
    expect(a.message).toContain(`${MAX_INTENTOS} intentos`);
  });
});

describe("leerFreno", () => {
  it("un valor roto o sin fecha no es un freno", () => {
    expect(leerFreno(undefined, AHORA)).toBeNull();
    expect(leerFreno("no es json", AHORA)).toBeNull();
    expect(leerFreno(JSON.stringify({ fallos: 10 }), AHORA)).toBeNull();
    expect(leerFreno(JSON.stringify({ hasta: "ayer" }), AHORA)).toBeNull();
  });
  it("devuelve la fecha normalizada y si rige, y nada más del valor", () => {
    const v = JSON.stringify({ hasta: "2026-09-23T18:20:00Z", fallos: 10, otro: "x@y.com" });
    expect(leerFreno(v, AHORA)).toEqual({ hasta: "2026-09-23T18:20:00.000Z", vigente: true });
  });
});

describe("las constantes copiadas de la cola de la app", () => {
  /* El MCP distingue "se está reintentando" de "se rindió" con los mismos
     números que usa la cola. Si alguien los cambia en la app y no acá, las
     alertas mienten en silencio: esto lo corta en el test. La imagen de
     Docker del MCP no trae la app, así que ahí se saltea con el motivo. */
  const ruta = new URL("../../cuervito/src/server/cola-fotos.ts", import.meta.url);
  const hay = existsSync(ruta);
  const fuente = hay ? readFileSync(ruta, "utf8") : "";

  it.skipIf(!hay)("INTENTOS_RAPIDOS", () => {
    const m = /const INTENTOS_RAPIDOS = (\d+);/.exec(fuente);
    expect(m, "no encontré INTENTOS_RAPIDOS en cola-fotos.ts").not.toBeNull();
    expect(Number(m![1])).toBe(INTENTOS_RAPIDOS);
  });

  it.skipIf(!hay)("MAX_INTENTOS y las horas de la etapa lenta", () => {
    const m = /const ESPERAS_LENTAS_H = \[([^\]]+)\];/.exec(fuente);
    expect(m, "no encontré ESPERAS_LENTAS_H en cola-fotos.ts").not.toBeNull();
    const horas = m![1]!.split(",").map((x) => Number(x.trim()));
    expect(horas.every(Number.isFinite)).toBe(true);
    // El arreglo entero y en orden: el MCP deduce cuándo falló cada foto con él.
    expect(horas).toEqual([...ESPERAS_LENTAS_H]);
    expect(fuente).toMatch(/const MAX_INTENTOS = INTENTOS_RAPIDOS \+ ESPERAS_LENTAS_H\.length;/);
    expect(INTENTOS_RAPIDOS + horas.length).toBe(MAX_INTENTOS);
    expect(horas.reduce((a, b) => a + b, 0)).toBe(HORAS_ETAPA_LENTA);
  });

  it.skipIf(!hay)("la espera de la etapa rápida", () => {
    const m = /const ESPERA_FALLO_MS = (\d+) \* 60_000;/.exec(fuente);
    expect(m, "no encontré ESPERA_FALLO_MS en cola-fotos.ts").not.toBeNull();
    expect(Number(m![1])).toBe(ESPERA_RAPIDA_MIN);
  });

  it.skipIf(!hay)("LEASE_MS", () => {
    const m = /const LEASE_MS = (\d+) \* 60_000;/.exec(fuente);
    expect(m, "no encontré LEASE_MS en cola-fotos.ts").not.toBeNull();
    expect(Number(m![1])).toBe(LEASE_MIN);
  });

  it.skipIf(!hay)("TOPE_UNIDAD_MS", () => {
    const m = /const TOPE_UNIDAD_MS = (\d+) \* 60_000;/.exec(fuente);
    expect(m, "no encontré TOPE_UNIDAD_MS en cola-fotos.ts").not.toBeNull();
    expect(Number(m![1])).toBe(TOPE_MIN);
  });

  it.skipIf(!hay)("la clave del freno", () => {
    expect(fuente).toContain(`const CLAVE_FRENO = "procesador:freno-reconocimiento";`);
  });
});
