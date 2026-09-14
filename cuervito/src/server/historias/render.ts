import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import satori from "satori";
import sharp from "sharp";

import { cajaFoto, FORMATOS, type Foco, type FormatoId, type PlantillaId } from "./formatos";
import { fuentesSatori } from "./fuentes";
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

// ── La marca ────────────────────────────────────────────────────────────────
// El logo de encontrate va como data URI porque satori no sale a la red. Se
// lee una vez por proceso: son dos PNG de 11 KB.
let marcaCache: { clara: string; tinta: string } | null = null;

async function marca(): Promise<{ clara: string; tinta: string }> {
  if (marcaCache) return marcaCache;
  const carpeta = path.join(process.cwd(), "public/marca");
  const uri = async (archivo: string) =>
    `data:image/png;base64,${(await readFile(path.join(carpeta, archivo))).toString("base64")}`;
  marcaCache = { clara: await uri("logo.png"), tinta: await uri("logo-tinta.png") };
  return marcaCache;
}

// ── Piezas ──────────────────────────────────────────────────────────────────

const acotar = (n: number) => Math.min(1, Math.max(0, n));

/**
 * Recorta la foto a una caja, con las esquinas redondeadas si se piden.
 *
 * Con `foco` el encuadre lo decide el fotógrafo: la foto se escala hasta
 * cubrir la caja y se desplaza para que ese punto —en fracciones de la foto—
 * caiga en el mismo punto de la caja. Es la misma regla que `object-position`
 * en CSS, y tiene que serlo: la pantalla muestra la foto con esa regla
 * mientras se arrastra, y lo que se ve al soltar tiene que ser lo que sale.
 *
 * Sin `foco`, el recorte inteligente de sharp busca la zona con más contraste
 * y detalle, que en una foto deportiva casi siempre es el atleta. No es
 * reconocimiento de caras y a veces se equivoca; para eso está el arrastre.
 * Se devuelve el foco que se usó, así el arrastre arranca desde donde quedó
 * la foto y no desde el centro.
 */
async function recortar(
  foto: Buffer,
  ancho: number,
  alto: number,
  radio: number,
  foco: Foco | null,
): Promise<{ png: Buffer; foco: Foco }> {
  const meta = await sharp(foto).metadata();
  const w = meta.width ?? ancho;
  const h = meta.height ?? alto;
  const escala = Math.max(ancho / w, alto / h);
  // Nunca por debajo de la caja: un redondeo hacia abajo dejaría el extract
  // un píxel fuera de la imagen, y sharp lo rechaza entero.
  const sw = Math.max(ancho, Math.round(w * escala));
  const sh = Math.max(alto, Math.round(h * escala));

  let base: sharp.Sharp;
  let usado: Foco;

  if (foco) {
    const left = Math.round((sw - ancho) * acotar(foco.x));
    const top = Math.round((sh - alto) * acotar(foco.y));
    base = sharp(foto)
      .resize(sw, sh, { fit: "fill" })
      .extract({ left, top, width: ancho, height: alto });
    usado = { x: acotar(foco.x), y: acotar(foco.y) };
  } else {
    const { data, info } = await sharp(foto)
      .resize(ancho, alto, { fit: "cover", position: sharp.strategy.attention })
      .png()
      .toBuffer({ resolveWithObject: true });
    base = sharp(data);
    // sharp devuelve el desplazamiento del recorte sobre la imagen ya
    // escalada, con signo negativo (es cuánto se corrió la imagen, no dónde
    // empieza el recorte). Llevado a fracción es el mismo foco que el
    // arrastre va a mandar.
    usado = {
      x: sw > ancho ? acotar(-(info.cropOffsetLeft ?? 0) / (sw - ancho)) : 0.5,
      y: sh > alto ? acotar(-(info.cropOffsetTop ?? 0) / (sh - alto)) : 0.5,
    };
  }

  if (radio <= 0) return { png: await base.png().toBuffer(), foco: usado };

  const mascara = Buffer.from(
    `<svg width="${ancho}" height="${alto}"><rect width="${ancho}" height="${alto}" rx="${radio}" ry="${radio}" fill="#fff"/></svg>`,
  );
  return {
    png: await base.composite([{ input: mascara, blend: "dest-in" }]).png().toBuffer(),
    foco: usado,
  };
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
    fonts: await fuentesSatori(),
  });
  // sharp rasteriza el SVG sin necesitar fuentes en el sistema: satori ya
  // convirtió las letras en trazos.
  return sharp(Buffer.from(svg)).png().toBuffer();
}

// ── El render ───────────────────────────────────────────────────────────────

/** Lo que el llamador sabe del evento. La marca la pone el render. */
export type DatosPieza = Omit<DatosHistoria, "marca">;

export async function renderHistoria({
  foto,
  plantilla,
  formato,
  datos,
  foco = null,
}: {
  /** Los bytes de la foto SIN marca de agua. */
  foto: Buffer;
  plantilla: PlantillaId;
  formato: FormatoId;
  datos: DatosPieza;
  /** El encuadre elegido a mano, o null para el automático. */
  foco?: Foco | null;
}): Promise<{ jpeg: Buffer; foco: Foco }> {
  const { ancho, alto } = FORMATOS[formato];
  const caja = cajaFoto(plantilla, formato);
  const d: DatosHistoria = { ...datos, marca: await marca() };

  const capas: sharp.OverlayOptions[] = [];
  let lienzo: sharp.Sharp;
  let usado: Foco;

  if (plantilla === "placa") {
    lienzo = sharp({
      create: {
        width: ancho,
        height: alto,
        channels: 4,
        background: d.color,
      },
    });
    const r = await recortar(foto, caja.ancho, caja.alto, caja.radio, foco);
    usado = r.foco;
    capas.push({ input: r.png, top: caja.top, left: caja.left });
  } else {
    const r = await recortar(foto, ancho, alto, 0, foco);
    usado = r.foco;
    lienzo = sharp(r.png);
  }

  capas.push({ input: await capaDibujo(plantilla, formato, ancho, alto, d) });

  const jpeg = await lienzo
    .composite(capas)
    // JPEG y no PNG: Instagram recomprime todo lo que sube igual, así que un
    // PNG de 4 MB sólo hace la subida más lenta y termina en el mismo JPEG.
    .jpeg({ quality: 92, chromaSubsampling: "4:4:4" })
    .toBuffer();

  return { jpeg, foco: usado };
}

export { tintaSobre };
