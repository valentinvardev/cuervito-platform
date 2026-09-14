import "server-only";

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { createElement } from "react";
import satori from "satori";
import sharp from "sharp";

import { db } from "~/server/db";
import { fuentesSatori } from "~/server/historias/fuentes";
import { CONFIG_POR_DEFECTO, esquemaConfig, type ConfigMarca } from "~/server/marca-agua-config";

/**
 * La marca de agua de la plataforma: qué se estampa y cómo.
 *
 * Antes era una sola cosa fija: el PNG que subía el admin, escalado al 40 %
 * del lado menor, rotado 35 grados y repetido en mosaico. Sin separación, sin
 * opacidad, sin texto, y con "CUERVITO" de respaldo si no había PNG.
 *
 * Ahora son dos cosas separadas:
 *
 *   · la UNIDAD: la imagen —el PNG subido, o el logo de encontrate si no hay
 *     ninguno— con un texto debajo, renderizado con la tipografía de la marca.
 *   · el PATRÓN: cómo se reparte la unidad sobre la foto. Es un SVG del tamaño
 *     de la foto con un <pattern>, así que escala, rotación, separación y
 *     opacidad son geometría declarada y no un bucle de composites.
 *
 * La configuración vive en Setting como JSON y la lee cada preview que se
 * genera. Cambiarla afecta a todo lo que se procese de ahí en más; lo ya
 * procesado se regenera desde el admin.
 */

/* ── La configuración ───────────────────────────────────────────────────── */

export {
  CONFIG_POR_DEFECTO,
  esquemaConfig,
  PATRONES,
  PATRONES_LISTA,
  type ConfigMarca,
  type Patron,
} from "~/server/marca-agua-config";

export const CLAVE_CONFIG_MARCA = "watermark:config";

/* La configuración y las unidades armadas viven en globalThis, como todo lo
   que comparten el procesador de fotos (que arranca en instrumentation.ts) y
   las rutas: son dos capas de webpack y un `let` de módulo serían dos copias.

   No se usa unstable_cache porque el procesador la pide fuera de cualquier
   request, y ahí unstable_cache no tiene dónde guardar y lanza. Es un TTL
   corto a mano; guardar la config la vacía en el acto, y como corre una sola
   instancia, "en el acto" alcanza. */
export type Unidad = { png: Buffer; ancho: number; alto: number };

declare global {
  var __cuervito_marca__:
    | {
        cfg: { valor: ConfigMarca; leidaEn: number } | null;
        unidades: Map<string, Unidad>;
      }
    | undefined;
}
const estado = (globalThis.__cuervito_marca__ ??= { cfg: null, unidades: new Map<string, Unidad>() });
const CFG_TTL_MS = 15_000;

export function analizarConfig(crudo: unknown): ConfigMarca {
  const p = esquemaConfig.safeParse(crudo);
  return p.success ? p.data : CONFIG_POR_DEFECTO;
}

export async function leerConfigMarca(): Promise<ConfigMarca> {
  if (estado.cfg && Date.now() - estado.cfg.leidaEn < CFG_TTL_MS) return estado.cfg.valor;
  const fila = await db.setting.findUnique({
    where: { key: CLAVE_CONFIG_MARCA },
    select: { value: true },
  });
  let valor = CONFIG_POR_DEFECTO;
  if (fila) {
    try {
      valor = analizarConfig(JSON.parse(fila.value));
    } catch {
      valor = CONFIG_POR_DEFECTO;
    }
  }
  estado.cfg = { valor, leidaEn: Date.now() };
  return valor;
}

export async function guardarConfigMarca(cfg: ConfigMarca): Promise<void> {
  const value = JSON.stringify(cfg);
  await db.setting.upsert({
    where: { key: CLAVE_CONFIG_MARCA },
    update: { value },
    create: { key: CLAVE_CONFIG_MARCA, value },
  });
  estado.cfg = null;
  estado.unidades.clear();
}

export function vaciarCacheMarca(): void {
  estado.cfg = null;
  estado.unidades.clear();
}

/* ── La unidad ──────────────────────────────────────────────────────────── */

/** El logo de encontrate, para cuando no hay PNG subido. */
export async function logoPorDefecto(color: ConfigMarca["color"]): Promise<Buffer> {
  const archivo = color === "tinta" ? "logo-tinta.png" : "logo.png";
  return readFile(path.join(process.cwd(), "public/marca", archivo));
}

/**
 * La unidad: la imagen a un ancho dado, con el texto debajo.
 *
 * El texto se renderiza con satori y no con el <text> de SVG porque sharp
 * rasteriza el SVG con las fuentes del sistema —en el VPS, ninguna de las
 * nuestras— y satori convierte las letras en trazos con las fuentes que
 * llevamos en el repo. Es el mismo camino que usan las historias.
 *
 * Una unidad por (imagen, texto, ancho) queda en caché: armarla son dos
 * renders y un composite, y una tanda de subida pide la misma cientos de
 * veces seguidas.
 */
export async function armarUnidad(opts: {
  imagen: Buffer | null;
  cfg: ConfigMarca;
  /** Ancho de la unidad en píxeles, ya calculado sobre la foto. */
  ancho: number;
  /** Con texto o sin él: la marca de un fotógrafo va sola. */
  conTexto: boolean;
}): Promise<Unidad> {
  const { cfg } = opts;
  const ancho = Math.max(24, Math.round(opts.ancho));
  const texto = opts.conTexto ? cfg.texto.trim() : "";
  const imagen = opts.imagen ?? (await logoPorDefecto(cfg.color));
  const clave = createHash("sha1")
    .update(imagen.subarray(0, 4096))
    .update(String(imagen.length))
    .update(`|${ancho}|${texto}|${cfg.textoEscala}|${cfg.color}`)
    .digest("hex");

  const hecha = estado.unidades.get(clave);
  if (hecha) return hecha;

  const img = await sharp(imagen, { limitInputPixels: 60_000_000 })
    .resize({ width: ancho, withoutEnlargement: false })
    .png()
    .toBuffer();
  const im = await sharp(img).metadata();
  const imgAlto = im.height ?? Math.round(ancho / 3);

  let unidad: Unidad;

  if (texto) {
    const tam = Math.max(10, Math.round(ancho * cfg.textoEscala));
    const color = cfg.color === "tinta" ? "#12110F" : "#FFFFFF";
    const altoTexto = Math.round(tam * 1.3);
    const svg = await satori(
      createElement(
        "div",
        {
          style: {
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            width: ancho,
            height: altoTexto,
            fontFamily: "Outfit",
            fontWeight: 600,
            fontSize: tam,
            letterSpacing: "-0.01em",
            color,
            whiteSpace: "nowrap",
          },
        },
        texto,
      ),
      { width: ancho, height: altoTexto, fonts: await fuentesSatori() },
    );
    const textoPng = await sharp(Buffer.from(svg)).png().toBuffer();
    const gap = Math.round(tam * 0.25);
    const alto = imgAlto + gap + altoTexto;

    const png = await sharp({
      create: { width: ancho, height: alto, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .composite([
        { input: img, top: 0, left: 0 },
        { input: textoPng, top: imgAlto + gap, left: 0 },
      ])
      .png()
      .toBuffer();
    unidad = { png, ancho, alto };
  } else {
    unidad = { png: img, ancho, alto: imgAlto };
  }

  if (estado.unidades.size > 64) estado.unidades.clear();
  estado.unidades.set(clave, unidad);
  return unidad;
}

/* ── El patrón ──────────────────────────────────────────────────────────── */

/**
 * La capa que se apoya sobre la foto: un SVG de su mismo tamaño.
 *
 * En mosaico y diagonal es un <pattern> con la unidad como <image>. En
 * mosaico cada unidad rota adentro de su celda, y las filas van corridas
 * media celda —como ladrillos— para que no queden pasillos vacíos. En
 * diagonal la unidad no rota: rota la trama entera con patternTransform, y
 * el resultado son hileras inclinadas.
 *
 * La opacidad va en un <g> y no en el PNG: así el mismo PNG sirve para
 * cualquier opacidad sin volver a renderizar.
 */
export function capaMarca(opts: {
  anchoFoto: number;
  altoFoto: number;
  unidad: Unidad;
  cfg: ConfigMarca;
}): sharp.OverlayOptions {
  const { anchoFoto: W, altoFoto: H, unidad: u, cfg } = opts;
  const href = `data:image/png;base64,${u.png.toString("base64")}`;
  const n = (x: number) => Math.round(x * 100) / 100;
  const img = (x: number, y: number, rot = 0) =>
    `<image href="${href}" xlink:href="${href}" x="${n(x)}" y="${n(y)}" width="${u.ancho}" height="${u.alto}"` +
    (rot ? ` transform="rotate(${rot} ${n(x + u.ancho / 2)} ${n(y + u.alto / 2)})"` : "") +
    ` />`;

  let cuerpo: string;
  let defs = "";
  const aire = u.ancho * cfg.separacion;

  if (cfg.patron === "mosaico") {
    // La celda envuelve a la unidad ya rotada, más el aire.
    const rad = (cfg.rotacion * Math.PI) / 180;
    const bw = Math.abs(u.ancho * Math.cos(rad)) + Math.abs(u.alto * Math.sin(rad));
    const bh = Math.abs(u.ancho * Math.sin(rad)) + Math.abs(u.alto * Math.cos(rad));
    const cw = Math.ceil(bw + aire);
    const ch = Math.ceil(bh + aire);
    const x = (cw - u.ancho) / 2;
    const y = (ch - u.alto) / 2;
    // Dos filas por celda: la segunda corrida medio paso, y su copia del
    // otro lado para que el corte de la celda no deje media unidad afuera.
    defs =
      `<pattern id="p" patternUnits="userSpaceOnUse" width="${cw}" height="${ch * 2}">` +
      img(x, y, cfg.rotacion) +
      img(x + cw / 2, y + ch, cfg.rotacion) +
      img(x - cw / 2, y + ch, cfg.rotacion) +
      `</pattern>`;
    cuerpo = `<rect width="${W}" height="${H}" fill="url(#p)" />`;
  } else if (cfg.patron === "diagonal") {
    const cw = Math.ceil(u.ancho + aire);
    const ch = Math.ceil(u.alto + aire);
    defs =
      `<pattern id="p" patternUnits="userSpaceOnUse" width="${cw}" height="${ch * 2}" patternTransform="rotate(${cfg.rotacion})">` +
      img((cw - u.ancho) / 2, (ch - u.alto) / 2) +
      img((cw - u.ancho) / 2 + cw / 2, (ch - u.alto) / 2 + ch) +
      img((cw - u.ancho) / 2 - cw / 2, (ch - u.alto) / 2 + ch) +
      `</pattern>`;
    // El rect se agranda para que la trama rotada cubra las esquinas.
    const d = Math.ceil(Math.hypot(W, H));
    cuerpo = `<rect x="${n((W - d) / 2)}" y="${n((H - d) / 2)}" width="${d}" height="${d}" fill="url(#p)" />`;
  } else if (cfg.patron === "centro") {
    cuerpo = img((W - u.ancho) / 2, (H - u.alto) / 2, cfg.rotacion);
  } else {
    const m = Math.round(W * cfg.margen);
    cuerpo = img(W - u.ancho - m, H - u.alto - m);
  }

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    (defs ? `<defs>${defs}</defs>` : "") +
    `<g opacity="${cfg.opacidad}">${cuerpo}</g></svg>`;

  return { input: Buffer.from(svg), blend: "over" };
}

/**
 * Todo junto: la capa lista para una foto de este tamaño.
 *
 * `imagen` es el PNG subido (de la plataforma o del fotógrafo) o null para
 * usar el logo de encontrate. `conTexto` va en false para la marca de un
 * fotógrafo: su logo con "encontrate.app" debajo no es de nadie.
 */
export async function capaParaFoto(opts: {
  anchoFoto: number;
  altoFoto: number;
  imagen: Buffer | null;
  cfg: ConfigMarca;
  conTexto: boolean;
}): Promise<sharp.OverlayOptions> {
  const ancho = Math.round(opts.anchoFoto * opts.cfg.escala);
  const unidad = await armarUnidad({
    imagen: opts.imagen,
    cfg: opts.cfg,
    ancho,
    conTexto: opts.conTexto,
  });
  return capaMarca({ anchoFoto: opts.anchoFoto, altoFoto: opts.altoFoto, unidad, cfg: opts.cfg });
}
