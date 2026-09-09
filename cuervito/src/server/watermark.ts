import "server-only";

import sharp from "sharp";

import { db } from "~/server/db";
import {
  createCFInvalidation,
  deleteS3Objects,
  getS3ObjectBytes,
  platformWatermarkKey,
  previewCleanPhotoKey,
  previewPhotoKey,
  putS3Object,
  thumbPhotoKey,
  CACHE_MOSTRAR,
  userWatermarkKey,
  headObject,
} from "~/server/s3";

const PREVIEW_MAX_WIDTH = 2400;
const PREVIEW_QUALITY = 85;
/* La miniatura de la grilla de la tienda.

   560px porque el recuadro de la grilla mide entre 212 y 300 CSS, y en una
   pantalla densa eso son hasta 600 píxeles reales. Medido sobre una foto real
   del evento: 2400px q85 son 845 KB, 560px q72 son 56 KB. Quince veces menos
   para algo que se ve idéntico a ese tamaño. */
const THUMB_WIDTH = 560;
const THUMB_QUALITY = 72;

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
const OPC_SHARP = { limitInputPixels: 60_000_000, failOn: "error" as const };

// ── Concurrency limiter ───────────────────────────────────────────────────────
// Sharp is CPU + memory intensive. Without a cap, uploading 50 photos at once
// fires 50 concurrent resize+watermark+S3-upload operations, which OOMs the
// VPS and produces 502s. Queue extras and process at most 3 at a time.
export const MAX_CONCURRENT = 3;

/* El contador vive en globalThis, como el bus de ventas y el cliente de Prisma.

   No es manía: instrumentation.ts —donde va a arrancar el procesador— y los
   route handlers se compilan en capas distintas de webpack, así que este
   módulo se evalúa DOS veces y un `let active` de módulo serían dos contadores
   de 3. Seis decodes de 24 MP a la vez es exactamente el escenario que el
   comentario de arriba dice que hizo OOM y 502. */
declare global {
  // eslint-disable-next-line no-var
  var __cuervito_sharp__: { active: number; waitQueue: Array<() => void> } | undefined;
}
const sem = (globalThis.__cuervito_sharp__ ??= { active: 0, waitQueue: [] });

export function tomarSlotSharp(): Promise<void> {
  return new Promise((resolve) => {
    if (sem.active < MAX_CONCURRENT) { sem.active++; resolve(); }
    else sem.waitQueue.push(() => { sem.active++; resolve(); });
  });
}

export function soltarSlotSharp() {
  sem.active--;
  sem.waitQueue.shift()?.();
}

// ── Watermark cache ───────────────────────────────────────────────────────────
// We keep one entry for the platform watermark and one per user who has their
// own. TTL is 60 s so a new upload is reflected quickly without hammering S3.

interface CacheEntry { bytes: Buffer; loadedAt: number }
let platformCache: CacheEntry | null = null;
const userCacheMap = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60_000;

async function loadPlatformWatermark(): Promise<Buffer | null> {
  if (platformCache && Date.now() - platformCache.loadedAt < CACHE_TTL_MS) {
    return platformCache.bytes;
  }
  try {
    const bytes = await getS3ObjectBytes(platformWatermarkKey());
    const buf = Buffer.from(bytes);
    platformCache = { bytes: buf, loadedAt: Date.now() };
    return buf;
  } catch {
    return null;
  }
}

async function loadUserWatermark(userId: string): Promise<Buffer | null> {
  const cached = userCacheMap.get(userId);
  if (cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) return cached.bytes;
  try {
    const bytes = await getS3ObjectBytes(userWatermarkKey(userId));
    const buf = Buffer.from(bytes);
    userCacheMap.set(userId, { bytes: buf, loadedAt: Date.now() });
    return buf;
  } catch {
    return null;
  }
}

/** Invalidate the in-process cache for the platform watermark. */
export function invalidateWatermarkCache() {
  platformCache = null;
}

/** Invalidate the per-user cache entry (call after the user uploads/deletes). */
export function invalidateUserWatermarkCache(userId: string) {
  userCacheMap.delete(userId);
}

async function buildComposite(
  imageWidth: number,
  imageHeight: number,
  ownerId?: string,
): Promise<{ input: Buffer; tile: boolean; blend: "over" }> {
  // Prefer the per-user watermark; fall back to the platform-wide one.
  const wm =
    (ownerId ? await loadUserWatermark(ownerId) : null) ??
    (await loadPlatformWatermark());

  if (wm) {
    const meta = await sharp(wm).metadata();
    const wmW = meta.width ?? 300;
    const wmH = meta.height ?? 100;
    const targetW = Math.round(Math.min(imageWidth, imageHeight) * 0.4);
    const targetH = Math.round((wmH / wmW) * targetW);

    const scaled = await sharp(wm)
      .resize(targetW, targetH, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .rotate(-35, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();

    return { input: scaled, tile: true, blend: "over" };
  }

  // Fallback: tiled PREVIEW text in a translucent SVG. Used when the admin
  // hasn't uploaded a watermark yet.
  const tileSize = 220;
  const half = tileSize / 2;
  const svg = Buffer.from(
    `<svg width="${tileSize}" height="${tileSize}" xmlns="http://www.w3.org/2000/svg">
      <text x="${half}" y="${half}" text-anchor="middle" dominant-baseline="middle"
        font-family="Arial, sans-serif" font-size="22" font-weight="bold" letter-spacing="3"
        fill="rgba(255,255,255,0.38)"
        transform="rotate(-35, ${half}, ${half})">CUERVITO</text>
    </svg>`,
  );
  return { input: svg, tile: true, blend: "over" };
}

/**
 * Read an original from S3, watermark it, write the .webp preview to S3,
 * update Photo.previewKey + previewGeneratedAt. Returns the new preview key
 * or null if the original couldn't be processed.
 */
/** Resultado de generar las previews de una foto.
 *  `rekognitionBytes` es el mismo buffer 2400px re-encodeado a JPEG: se
 *  devuelve para que OCR y face-index lo reusen en vez de volver a bajar
 *  el original de S3. Rekognition no acepta WebP, por eso no sirve el
 *  previewClean que guardamos en el bucket. */
export type PreviewResult = {
  watermarkedKey: string | null;
  rekognitionBytes: Uint8Array | null;
  /** Por qué no se pudo. `permanente` significa que reintentar no sirve. */
  error?: { mensaje: string; permanente: boolean };
};

export async function generatePreview(photoId: string): Promise<PreviewResult> {
  await tomarSlotSharp();
  try {
    return await _generatePreview(photoId);
  } finally {
    soltarSlotSharp();
  }
}

/**
 * Este fallo, reintentado, da lo mismo?
 *
 * Es la diferencia entre "no pude" y "no voy a poder nunca". Un archivo que no
 * es una imagen, o que se pasa del límite de píxeles, no mejora en el segundo
 * intento: reintentarlo es bajar 15 MB de S3 cada vez, para siempre. Una caída
 * de red sí mejora.
 */
function esPermanente(err: unknown): boolean {
  const m = err instanceof Error ? err.message : String(err);
  return /unsupported image format|VipsJpeg|premature end|input buffer|pixel limit|unsupported/i.test(m);
}

async function _generatePreview(photoId: string): Promise<PreviewResult> {
  const photo = await db.photo.findUnique({
    where: { id: photoId },
    select: {
      id: true,
      eventId: true,
      ownerId: true,
      storageKey: true,
      previewKey: true,
      previewCleanKey: true,
      thumbKey: true,
    },
  });
  if (!photo) {
    return {
      watermarkedKey: null,
      rekognitionBytes: null,
      error: { mensaje: "la foto ya no está en la base", permanente: true },
    };
  }

  let raw: Uint8Array;
  try {
    raw = await getS3ObjectBytes(photo.storageKey);
  } catch (err) {
    console.error("[watermark] download failed:", photo.storageKey, err);
    // Transitorio salvo que el objeto de verdad no esté: la red se cae, S3
    // tiene un mal momento. Si no está, no va a aparecer reintentando.
    const h = await headObject(photo.storageKey);
    return {
      watermarkedKey: null,
      rekognitionBytes: null,
      error: {
        mensaje: err instanceof Error ? err.message : String(err),
        permanente: h.estado === "no-existe",
      },
    };
  }

  const buf = Buffer.from(raw);

  try {
    /* metadata() ADENTRO del try.

       Estaba afuera, y es la primera línea que toca los bytes del usuario: un
       HEIC con extensión .jpg, o un archivo truncado, la hace lanzar. La
       excepción escapaba de _generatePreview en vez de volverse un resultado
       con error, así que el llamador —que trata esto como "devuelve nulls"—
       se comía un rechazo que nadie atrapa. */
    const meta = await sharp(buf, OPC_SHARP).metadata();
    const w = meta.width ?? 1200;
    const h = meta.height ?? 800;

    const resized =
      w > PREVIEW_MAX_WIDTH
        ? await sharp(buf, OPC_SHARP)
            .resize({ width: PREVIEW_MAX_WIDTH, withoutEnlargement: true })
            .toBuffer()
        : buf;
    const resizedMeta = w > PREVIEW_MAX_WIDTH ? await sharp(resized).metadata() : { width: w, height: h };

    // Generate watermarked preview FIRST so the public-facing image is
    // guaranteed correct before anything else touches state. Each pipeline
    // takes its own copy of `resized` to prevent any chance of sharp's
    // internal state bleeding between the two outputs.
    const composite = await buildComposite(
      resizedMeta.width ?? w,
      resizedMeta.height ?? h,
      photo.ownerId,
    );
    const watermarkedOut = await sharp(Buffer.from(resized), OPC_SHARP)
      .composite([composite])
      .webp({ quality: PREVIEW_QUALITY })
      .toBuffer();

    // Clean preview (same dimensions/quality, no watermark) for the
    // photographer's own dashboard.
    const cleanOut = await sharp(Buffer.from(resized), OPC_SHARP)
      .webp({ quality: PREVIEW_QUALITY })
      .toBuffer();

    /* La miniatura sale de la imagen YA MARCADA y no del original.

       Si se compusiera la marca sobre una imagen de 560px habría que escalar
       también la marca, y dos caminos que dibujan la misma marca a tamaños
       distintos se separan en la primera corrección que se hace en uno solo.
       Achicando la marcada, la marca queda igual, sólo que más chica. */
    const thumbOut = await sharp(Buffer.from(watermarkedOut), OPC_SHARP)
      .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
      .webp({ quality: THUMB_QUALITY })
      .toBuffer();

    // Derivado JPEG para Rekognition. No se sube a S3: viaja en memoria
    // hasta runOcr/runFaceIndex y se descarta. Reusa `resized`, así que
    // cuesta un encode y ahorra dos descargas del original + dos resizes.
    const rekognitionBytes = await sharp(Buffer.from(resized), OPC_SHARP)
      .jpeg({ quality: PREVIEW_QUALITY })
      .toBuffer();

    // Delete stale previews before writing new ones
    const stale: string[] = [];
    if (photo.previewKey) stale.push(photo.previewKey);
    if (photo.previewCleanKey) stale.push(photo.previewCleanKey);
    if (photo.thumbKey) stale.push(photo.thumbKey);
    if (stale.length > 0) {
      await deleteS3Objects(stale).catch(() => undefined);
    }

    const cleanKey = previewCleanPhotoKey(photo.ownerId, photo.eventId, photo.id);
    const watermarkedKey = previewPhotoKey(photo.ownerId, photo.eventId, photo.id);
    const thumbKey = thumbPhotoKey(photo.ownerId, photo.eventId, photo.id);
    await Promise.all([
      putS3Object(cleanKey, cleanOut, "image/webp", CACHE_MOSTRAR),
      putS3Object(watermarkedKey, watermarkedOut, "image/webp", CACHE_MOSTRAR),
      putS3Object(thumbKey, thumbOut, "image/webp", CACHE_MOSTRAR),
    ]);

    await db.photo.update({
      where: { id: photo.id },
      data: {
        previewKey: watermarkedKey,
        previewCleanKey: cleanKey,
        // La miniatura SE SUBÍA a S3 tres líneas más arriba y no se guardaba
        // acá, así que para la base no existía: 2.620 fotos con el archivo de
        // 56 KB sentado en el bucket mientras la grilla les servía el preview
        // de 845 KB. Todo el trabajo de agosto para que la galería abriera
        // rápido se apagó solo, sin romper nada, sin un error en ningún lado.
        thumbKey,
        previewGeneratedAt: new Date(),
        width: resizedMeta.width ?? w,
        height: resizedMeta.height ?? h,
      },
    });

    return { watermarkedKey, rekognitionBytes: new Uint8Array(rekognitionBytes) };
  } catch (err) {
    const permanente = esPermanente(err);
    console.error(
      `[watermark] error for photoId=${photo.id} permanente=${permanente}:`,
      err,
    );
    return {
      watermarkedKey: null,
      rekognitionBytes: null,
      error: {
        mensaje: err instanceof Error ? err.message : String(err),
        permanente,
      },
    };
  }
}
