import { describe, expect, it } from "vitest";

import { ErrorHerramienta } from "../src/errores.js";
import {
  aTimestamp,
  describir,
  medianocheUTC,
  resolverPeriodo,
  resolverSemana,
  semanaAnterior,
} from "../src/periodo.js";

const ZONA = "America/Argentina/Buenos_Aires";
/** Miércoles 23/9/2026, 15:00 en Buenos Aires. */
const MIERCOLES = new Date("2026-09-23T18:00:00Z");
/** Miércoles 23/9/2026, 23:30 en Buenos Aires: ya es jueves en UTC. */
const MIERCOLES_NOCHE = new Date("2026-09-24T02:30:00Z");

describe("medianoche", () => {
  it("la medianoche de Buenos Aires son las 03:00 UTC", () => {
    expect(medianocheUTC({ y: 2026, m: 9, d: 23 }, ZONA).toISOString()).toBe("2026-09-23T03:00:00.000Z");
  });
  it("funciona con zonas con horario de verano", () => {
    // Madrid: el 29/3/2026 pasa de UTC+1 a UTC+2.
    expect(medianocheUTC({ y: 2026, m: 3, d: 28 }, "Europe/Madrid").toISOString()).toBe("2026-03-27T23:00:00.000Z");
    expect(medianocheUTC({ y: 2026, m: 3, d: 30 }, "Europe/Madrid").toISOString()).toBe("2026-03-29T22:00:00.000Z");
  });
  it("el literal de timestamp no lleva zona, como guarda Prisma", () => {
    expect(aTimestamp(new Date("2026-09-23T03:00:00Z"))).toBe("2026-09-23T03:00:00.000");
  });
});

describe("períodos", () => {
  it("today es hoy en Buenos Aires, aunque en UTC ya sea mañana", () => {
    const p = resolverPeriodo({ period: "today" }, ZONA, MIERCOLES_NOCHE);
    expect(describir(p)).toMatchObject({ from: "2026-09-23", to: "2026-09-23" });
    expect(p.desde.toISOString()).toBe("2026-09-23T03:00:00.000Z");
    expect(p.hasta.toISOString()).toBe("2026-09-24T03:00:00.000Z");
  });

  it("last_7d son hoy y los seis días anteriores", () => {
    const p = resolverPeriodo({ period: "last_7d" }, ZONA, MIERCOLES);
    expect(describir(p)).toMatchObject({ label: "last_7d", from: "2026-09-17", to: "2026-09-23" });
  });

  it("last_30d son hoy y los veintinueve anteriores", () => {
    const p = resolverPeriodo({ period: "last_30d" }, ZONA, MIERCOLES);
    expect(describir(p)).toMatchObject({ from: "2026-08-25", to: "2026-09-23" });
  });

  it("sin period, last_7d", () => {
    expect(resolverPeriodo({}, ZONA, MIERCOLES).etiqueta).toBe("last_7d");
  });

  it("custom incluye el día final entero", () => {
    const p = resolverPeriodo({ period: "custom", from: "2026-09-01", to: "2026-09-10" }, ZONA, MIERCOLES);
    expect(p.desde.toISOString()).toBe("2026-09-01T03:00:00.000Z");
    expect(p.hasta.toISOString()).toBe("2026-09-11T03:00:00.000Z");
  });

  const INVALIDOS: [string, Record<string, string>][] = [
    ["sin to", { period: "custom", from: "2026-09-01" }],
    ["fecha inexistente", { period: "custom", from: "2026-02-30", to: "2026-03-02" }],
    ["formato roto", { period: "custom", from: "01/09/2026", to: "2026-09-10" }],
    ["from después de to", { period: "custom", from: "2026-09-10", to: "2026-09-01" }],
    ["más de 366 días", { period: "custom", from: "2025-01-01", to: "2026-09-01" }],
    ["empieza en el futuro", { period: "custom", from: "2026-10-01", to: "2026-10-05" }],
    ["period desconocido", { period: "last_year" }],
  ];
  it.each(INVALIDOS)("rechaza un período %s con invalid_period", (_, entrada) => {
    try {
      resolverPeriodo(entrada, ZONA, MIERCOLES);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ErrorHerramienta);
      expect((e as ErrorHerramienta).codigo).toBe("invalid_period");
    }
  });
});

describe("semanas", () => {
  it("sin week_start, la última semana completa de lunes a domingo", () => {
    const p = resolverSemana(undefined, ZONA, MIERCOLES);
    expect(describir(p)).toMatchObject({ label: "week", from: "2026-09-14", to: "2026-09-20" });
  });

  it("un domingo a la noche, la última completa es la anterior, no la que termina hoy", () => {
    const domingo = new Date("2026-09-21T02:00:00Z"); // domingo 20/9, 23:00 ART
    expect(describir(resolverSemana(undefined, ZONA, domingo))).toMatchObject({ from: "2026-09-07", to: "2026-09-13" });
  });

  it("la semana anterior es la de siete días antes", () => {
    const p = resolverSemana("2026-09-14", ZONA, MIERCOLES);
    expect(describir(semanaAnterior(p))).toMatchObject({ from: "2026-09-07", to: "2026-09-13" });
  });

  it("acepta la semana en curso", () => {
    expect(describir(resolverSemana("2026-09-21", ZONA, MIERCOLES))).toMatchObject({ from: "2026-09-21", to: "2026-09-27" });
  });

  it.each([
    ["un miércoles", "2026-09-16"],
    ["una semana futura", "2026-09-28"],
    ["una fecha rota", "2026-13-01"],
  ])("rechaza week_start en %s", (_, fecha) => {
    expect(() => resolverSemana(fecha, ZONA, MIERCOLES)).toThrow(ErrorHerramienta);
  });
});
