import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { createElement } from "react";
import satori from "satori";
import sharp from "sharp";

import { env } from "~/env";
import { fuentesSatori } from "~/server/historias/fuentes";

import { BASE } from "./base";

/**
 * Los titulares de los mails, como imagen.
 *
 * Gmail no carga tipografías web: ni Unbounded ni Outfit llegan nunca, en
 * ninguna de sus versiones. Un titular en texto cae en la fuente del sistema
 * —en el iPhone, Helvetica, porque Arial Black no viene instalada—, y el
 * titular es justamente lo que dice "encontrate" antes de leer nada. Así que
 * se dibuja en el servidor con la fuente de verdad, igual que las historias, y
 * el texto va entero en el alt: con las imágenes bloqueadas se lee igual.
 *
 * Al doble del ancho en que se ve, sobre blanco y no transparente: con fondo
 * transparente, el modo oscuro de algunos clientes deja tinta sobre tinta.
 * El texto viaja en la URL con una firma, para que nadie use la ruta para
 * dibujar lo que quiera con la marca.
 */

/** Ancho del cuerpo de la tarjeta en el mail (560 − 2 × 36), por dos. */
const ANCHO = 976;
const CUERPO = 60;
const INTERLINEA = 64;

function firmar(texto: string): string {
  return createHmac("sha256", String(env.AUTH_SECRET ?? "sin-secreto"))
    .update(`titular:${texto}`)
    .digest("hex")
    .slice(0, 32);
}

export function verificarTitular(texto: string, firma: string): boolean {
  const esperada = Buffer.from(firmar(texto));
  const dada = Buffer.from(firma);
  return esperada.length === dada.length && timingSafeEqual(esperada, dada);
}

export function titularUrl(texto: string): string {
  const t = Buffer.from(texto, "utf8").toString("base64url");
  return `${BASE}/api/correos/titular/${t}/${firmar(texto)}.png`;
}

export function textoDeTitular(codificado: string): string | null {
  try {
    const t = Buffer.from(codificado, "base64url").toString("utf8");
    return t.length > 0 && t.length <= 200 ? t : null;
  } catch {
    return null;
  }
}

/** El titular en caja alta, Unbounded 800, del alto que pidan sus renglones. */
export async function dibujarTitular(texto: string): Promise<Buffer> {
  const svg = await satori(
    createElement(
      "div",
      {
        style: {
          display: "flex",
          width: ANCHO,
          background: "#FFFFFF",
          color: "#12110F",
          fontFamily: "Unbounded",
          fontWeight: 800,
          fontSize: CUERPO,
          lineHeight: `${INTERLINEA}px`,
          letterSpacing: -0.045 * CUERPO,
        },
      },
      texto.toLocaleUpperCase("es-AR"),
    ),
    { width: ANCHO, fonts: await fuentesSatori() },
  );
  return sharp(Buffer.from(svg)).flatten({ background: "#FFFFFF" }).png({ compressionLevel: 9, palette: true }).toBuffer();
}
