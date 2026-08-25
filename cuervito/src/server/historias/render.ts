import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import satori from "satori";
import sharp from "sharp";

import { FORMATOS, type FormatoId, type PlantillaId } from "./formatos";
import { dibujar, tintaSobre, type DatosHistoria } from "./plantillas";

/**
 * Arma la imagen final.
 *
 * Tres capas, y el orden importa:
 *
 *   1. el fondo   — la foto a sangre, o el color de la marca
 *   2. la foto    — sólo en las plantillas donde va recortada adentro
 *   3. el dibujo  — degradado, texto y logo, que salen de satori
 *
 * La foto NUNCA pasa por un modelo ni por un filtro que la reinterprete: se
 * recorta y se pega. Es la foto de una persona real que alguien va a comprar;
 * si la cara que sale no es la que estaba, el producto entero deja de tener
 * sentido.
 */

// ── Fuentes ─────────────────────────────────────────────────────────────────
// satori pide los archivos, no los nombres: corre fuera del navegador y no hay
// CSS que resuelva nada. Van versionadas en el repo y no bajadas al vuelo
// porque una historia que falla porque Google Fonts tardó no se puede explicar.
const FUENTES = path.join(process.cwd(), "src/server/historias/fuentes");

type Fuente = { name: string; data: Buffer; weight: 400 | 600 | 800; style: "normal" };
let fuentesCache: Fuente[] | null = null;

async function fuentes(): Promise<Fuente[]> {
  fuentesCache ??= [
    { name: "Outfit", data: await readFile(path.join(FUENTES, "Outfit-400.ttf")), weight: 400, style: "normal" },
    { name: "Outfit", data: await readFile(path.join(FUENTES, "Outfit-600.ttf")), weight: 600, style: "normal" },
    { name: "Unbounded", data: await readFile(path.join(FUENTES, "Unbounded-800.ttf")), weight: 800, style: "normal" },
  ];
  return fuentesCache;
}

// ── Piezas ──────────────────────────────────────────────────────────────────

/** Recorta la foto a una caja, con las esquinas redondeadas si se piden. */
async function recortar(
  foto: Buffer,
  ancho: number,
  alto: number,
  radio = 0,
): Promise<Buffer> {
  const base = sharp(foto).resize(ancho, alto, {
    fit: "cover",
    // El recorte inteligente de sharp busca la zona con más contraste y
    // detalle, que en una foto deportiva casi siempre es el atleta. No es
    // reconocimiento de caras y a veces se equivoca; es lo que reemplaza el
    // punto focal que va a dar el modelo cuando enchufemos esa parte.
    position: sharp.strategy.attention,
  });

  if (radio <= 0) return base.png().toBuffer();

  const mascara = Buffer.from(
    `<svg width="${ancho}" height="${alto}"><rect width="${ancho}" height="${alto}" rx="${radio}" ry="${radio}" fill="#fff"/></svg>`,
  );
  return base.composite([{ input: mascara, blend: "dest-in" }]).png().toBuffer();
}

/** El dibujo de satori, ya rasterizado. */
async function capaDibujo(
  plantilla: PlantillaId,
  formato: FormatoId,
  ancho: number,
  alto: number,
  d: DatosHistoria,
): Promise<Buffer> {
  const svg = await satori(dibujar({ plantilla, formato, ancho, alto, d }), {
    width: ancho,
    height: alto,
    fonts: await fuentes(),
  });
  // sharp rasteriza el SVG sin necesitar fuentes en el sistema: satori ya
  // convirtió las letras en trazos.
  return sharp(Buffer.from(svg)).png().toBuffer();
}

// ── El render ───────────────────────────────────────────────────────────────

export async function renderHistoria({
  foto,
  plantilla,
  formato,
  datos,
}: {
  /** Los bytes de la foto SIN marca de agua. */
  foto: Buffer;
  plantilla: PlantillaId;
  formato: FormatoId;
  datos: DatosHistoria;
}): Promise<Buffer> {
  const { ancho, alto } = FORMATOS[formato];

  const capas: sharp.OverlayOptions[] = [];
  let lienzo: sharp.Sharp;

  if (plantilla === "placa") {
    lienzo = sharp({
      create: {
        width: ancho,
        height: alto,
        channels: 4,
        background: datos.color,
      },
    });

    // La foto ocupa el ancho menos los márgenes y deja abajo el alto que el
    // texto necesita. Se calcula sobre el alto total y no con un número fijo
    // porque el posteo es 570px más bajo que la historia: con una caja fija,
    // en 4:5 el texto quedaba encima de la foto.
    const margen = Math.round(ancho * (formato === "historia" ? 0.072 : 0.057));
    const cajaAncho = ancho - margen * 2;
    const cajaAlto = Math.round(alto * (formato === "historia" ? 0.58 : 0.5));
    capas.push({
      input: await recortar(foto, cajaAncho, cajaAlto, Math.round(ancho * 0.028)),
      top: margen,
      left: margen,
    });
  } else {
    lienzo = sharp(await recortar(foto, ancho, alto));
  }

  capas.push({ input: await capaDibujo(plantilla, formato, ancho, alto, datos) });

  return lienzo
    .composite(capas)
    // JPEG y no PNG: Instagram recomprime todo lo que sube igual, así que un
    // PNG de 4 MB sólo hace la subida más lenta y termina en el mismo JPEG.
    .jpeg({ quality: 92, chromaSubsampling: "4:4:4" })
    .toBuffer();
}

export { tintaSobre };
