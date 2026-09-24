import { describe, expect, it } from "vitest";

import { ErrorPrivacidad } from "../src/errores.js";
import { CLAVES_PERMITIDAS, montoProtegido, tasa, verificarSalida } from "../src/privacidad.js";

/**
 * El control de privacidad por sí solo. Los tests de herramientas prueban que
 * las respuestas reales lo pasan; éstos, que lo que NO debería pasar no pasa.
 */

const CLAVES_PII_TIPICAS = [
  "email", "buyerEmail", "buyer_email", "name", "buyerName", "firstName", "phone", "buyerPhone",
  "userId", "user_id", "ownerId", "sellerId", "visitorId", "photoId", "photoIds", "eventId", "saleId", "id",
  "url", "previewUrl", "photo_url", "storageKey", "previewKey", "slug",
  "ip", "userAgent", "embedding", "faceId", "bibNumbers", "dorsal", "dorsales",
  "cardLast4", "last4", "mpPaymentId", "mpAccessToken", "token", "password", "address",
];

describe("claves", () => {
  it.each(CLAVES_PII_TIPICAS)("rechaza la clave %s", (clave) => {
    expect(() => verificarSalida({ [clave]: 1 })).toThrow(ErrorPrivacidad);
  });

  it("rechaza una clave PII escondida varios niveles adentro", () => {
    expect(() => verificarSalida({ sales: { purchases_gross: [{ currency: "ARS", buyerEmail: "x" }] } })).toThrow(
      ErrorPrivacidad,
    );
  });

  it("ninguna clave PII típica está en la lista de permitidas", () => {
    for (const c of CLAVES_PII_TIPICAS) expect(CLAVES_PERMITIDAS.has(c)).toBe(false);
  });

  it("dice DÓNDE estaba el problema pero nunca el valor", () => {
    try {
      verificarSalida({ usage: { buyerEmail: "ana@example.com" } });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ErrorPrivacidad);
      expect((e as ErrorPrivacidad).mensajeSeguro).toContain("$.usage.buyerEmail");
      expect((e as ErrorPrivacidad).mensajeSeguro).not.toContain("ana@example.com");
    }
  });
});

describe("valores", () => {
  const PROHIBIDOS: [string, string][] = [
    ["mail", "contacto: ana.perez@gmail.com"],
    ["url", "https://d111.cloudfront.net/x.webp"],
    ["www", "ver www.ejemplo.com.ar"],
    ["cuid", "cmpbscf930000l400wrmr5rp7"],
    ["uuid", "00d86a36-2570-4631-9e51-1169b177577d"],
    ["teléfono", "+54 9 11 5555-1234"],
    ["clave de S3", "cuervito/users/abc/events/def/original/x.jpg"],
    ["ruta original", "algo /original/foto.jpg"],
    ["jwt", "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTYifQ.abc"],
  ];
  it.each(PROHIBIDOS)("rechaza un texto con %s", (_, texto) => {
    expect(() => verificarSalida({ message: texto })).toThrow(ErrorPrivacidad);
  });

  it("rechaza un texto demasiado largo (una fila volcada entera)", () => {
    expect(() => verificarSalida({ message: "a".repeat(501) })).toThrow(ErrorPrivacidad);
  });

  it("rechaza números inventados: NaN e Infinity", () => {
    expect(() => verificarSalida({ failure_rate: Number.NaN })).toThrow(ErrorPrivacidad);
    expect(() => verificarSalida({ failure_rate: Number.POSITIVE_INFINITY })).toThrow(ErrorPrivacidad);
  });

  it("rechaza undefined y bigint", () => {
    expect(() => verificarSalida({ count: undefined })).toThrow(ErrorPrivacidad);
    expect(() => verificarSalida({ count: 1n })).toThrow(ErrorPrivacidad);
  });

  it("acepta lo que sí sale: fechas, zonas, códigos, monedas y mensajes con números", () => {
    expect(() =>
      verificarSalida({
        period: { label: "custom", from: "2026-09-14", to: "2026-09-20", timezone: "America/Argentina/Buenos_Aires" },
        generated_at: "2026-09-23T18:00:00.000Z",
        purchases_gross: [{ currency: "ARS", amount: 171000, suppressed: false }],
        alerts: [{ severity: "warning", code: "photos_parked", message: "10 fotos quedaron apartadas después de 4 intentos." }],
        failure_rate: 0.0339,
        dorsal_searches: null,
      }),
    ).not.toThrow();
  });
});

describe("montos", () => {
  it("con menos compras que el mínimo, no informa el total", () => {
    expect(montoProtegido(1, 300_000, 5)).toBeNull();
    expect(montoProtegido(4, 1_200_000, 5)).toBeNull();
  });
  it("desde el mínimo, informa el total en unidades", () => {
    expect(montoProtegido(5, 1_500_000, 5)).toBe(15_000);
    expect(montoProtegido(57, 17_100_050, 5)).toBe(171_000.5);
  });
});

describe("tasas", () => {
  it("es null si el denominador es cero, nunca NaN", () => {
    expect(tasa(0, 0)).toBeNull();
  });
  it("redondea a cuatro decimales", () => {
    expect(tasa(2, 59)).toBe(0.0339);
    expect(tasa(1, 3)).toBe(0.3333);
  });
});
