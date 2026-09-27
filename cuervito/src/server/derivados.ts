import sharp from "sharp";

import type { ConfigMarca } from "~/server/marca-agua-config";

/**
 * Los derivados de una foto: la vista previa marcada, la limpia y la
 * miniatura. Sin nada del servidor —ni base, ni S3, ni "server-only"— porque
 * los arman dos lugares que tienen que dar lo mismo byte a byte: el
 * procesador del VPS (watermark.ts) y la Lambda que trabaja al lado de S3
 * (lambda-derivados/). Cómo se consiguen los bytes del original y la capa de
 * la marca, y dónde se guarda el resultado, lo decide cada uno.
 */

export const PREVIEW_MAX_WIDTH = 2400;
export const PREVIEW_QUALITY = 85;
/* La miniatura de la grilla de la tienda.

   560px porque el recuadro de la grilla mide entre 212 y 300 CSS, y en una
   pantalla densa eso son hasta 600 píxeles reales. Medido sobre una foto real
   del evento: 2400px q85 son 845 KB, 560px q72 son 56 KB. Quince veces menos
   para algo que se ve idéntico a ese tamaño. */
export const THUMB_WIDTH = 560;
export const THUMB_QUALITY = 72;

/**
 * Cómo se abre cualquier imagen que mandó un usuario.
 *
 * limitInputPixels es el que importa. QUOTA_MAX_PHOTO_BYTES son 30 MB y sharp
 * acepta hasta ~268 megapíxeles por defecto: un PNG de 20.000x20.000 entra
 * cómodo en 30 MB comprimido y al descomprimirlo son ~1,2 GB de RAM. Eso no
 * lanza una excepción que se pueda atrapar: mata el proceso. Y como el proceso
 * muere antes de anotar el intento, al reiniciar toma la misma foto y vuelve a
 * morir, para siempre. 60 MP cubre cualquier cámara con margen.
 */
export const OPC_SHARP = { limitInputPixels: 60_000_000, failOn: "error" as const };

export type Derivados = {
  marcada: Buffer;
  limpia: Buffer;
  miniatura: Buffer;
  /** JPEG del tamaño de la vista previa, para Rekognition; sólo si se pidió. */
  paraRekognition: Buffer | null;
  ancho: number;
  alto: number;
};

/** Anota cuánto tardó cada etapa. Opcional. */
export type Reloj = { marca(nombre: string): void };

/**
 * Lo que el VPS le pide a la Lambda de derivados (lambda-derivados/).
 *
 * Viaja todo lo que la Lambda necesita para no tocar la base: dónde está el
 * original, dónde van los tres derivados, qué claves viejas borrar antes, y la
 * marca ya resuelta —la unidad armada para una foto de `anchoEsperado` de
 * ancho y la configuración del patrón—. Si la foto sale de otro ancho (un
 * original más angosto que la vista previa), la unidad no le sirve y la
 * Lambda contesta "angosta": esa foto la procesa el VPS.
 */
export type PedidoDerivados = {
  bucket: string;
  original: string;
  claves: { marcada: string; limpia: string; miniatura: string };
  viejas: string[];
  anchoEsperado: number;
  /** La unidad en PNG, en base64. */
  unidad: { png: string; ancho: number; alto: number };
  cfg: ConfigMarca;
  cacheControl: string;
};

export type RespuestaDerivados =
  | { ok: true; ancho: number; alto: number; bytes: number; etapas: Record<string, number> }
  /** angosta: le toca al VPS. imagen: el original no se pudo abrir (el VPS
   *  lo vuelve a intentar y decide si es permanente). error: la Lambda falló. */
  | { ok: false; motivo: "angosta" | "imagen" | "error"; mensaje?: string };

/**
 * Del original a los tres derivados.
 *
 * `capaPara` recibe el tamaño final de la foto y devuelve la capa de la marca
 * para ese tamaño: la calcula quien llama, porque de dónde sale la marca (la
 * configuración, la imagen, la caché) es cosa suya.
 */
export async function hacerDerivados(
  original: Buffer,
  capaPara: (ancho: number, alto: number) => Promise<sharp.OverlayOptions>,
  opts: { reloj?: Reloj; conJpegRekognition?: boolean } = {},
): Promise<Derivados> {
  const reloj = opts.reloj ?? { marca: () => undefined };

  /* metadata() ADENTRO de lo que puede fallar.

     Es la primera línea que toca los bytes del usuario: un HEIC con extensión
     .jpg, o un archivo truncado, la hace lanzar, y quien llama lo tiene que
     ver como un resultado con error. */
  const meta = await sharp(original, OPC_SHARP).metadata();
  reloj.marca("metadata");
  const w = meta.width ?? 1200;
  const h = meta.height ?? 800;

  const resized =
    w > PREVIEW_MAX_WIDTH
      ? await sharp(original, OPC_SHARP)
          .resize({ width: PREVIEW_MAX_WIDTH, withoutEnlargement: true })
          .toBuffer()
      : original;
  const resizedMeta = w > PREVIEW_MAX_WIDTH ? await sharp(resized).metadata() : { width: w, height: h };
  const ancho = resizedMeta.width ?? w;
  const alto = resizedMeta.height ?? h;
  reloj.marca("achicar");

  // La marcada PRIMERO, para que la imagen pública esté bien antes que nada.
  // Cada pipeline toma su propia copia de `resized` para que el estado interno
  // de sharp no se cruce entre las salidas.
  const capa = await capaPara(ancho, alto);
  reloj.marca("capa-marca");
  const marcada = await sharp(Buffer.from(resized), OPC_SHARP)
    .composite([capa])
    .webp({ quality: PREVIEW_QUALITY })
    .toBuffer();
  reloj.marca("estampar");

  // La limpia: mismas medidas y calidad, sin marca, para el panel del fotógrafo.
  const limpia = await sharp(Buffer.from(resized), OPC_SHARP)
    .webp({ quality: PREVIEW_QUALITY })
    .toBuffer();
  reloj.marca("limpia");

  /* La miniatura sale de la imagen YA MARCADA y no del original.

     Si se compusiera la marca sobre una imagen de 560px habría que escalar
     también la marca, y dos caminos que dibujan la misma marca a tamaños
     distintos se separan en la primera corrección que se hace en uno solo.
     Achicando la marcada, la marca queda igual, sólo que más chica. */
  const miniatura = await sharp(Buffer.from(marcada), OPC_SHARP)
    .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
    .webp({ quality: THUMB_QUALITY })
    .toBuffer();
  reloj.marca("miniatura");

  let paraRekognition: Buffer | null = null;
  if (opts.conJpegRekognition) {
    paraRekognition = await sharp(Buffer.from(resized), OPC_SHARP)
      .jpeg({ quality: PREVIEW_QUALITY })
      .toBuffer();
    reloj.marca("jpeg-rek");
  }

  return { marcada, limpia, miniatura, paraRekognition, ancho, alto };
}
