import "server-only";

import sharp from "sharp";

import { db } from "~/server/db";
import {
  deleteS3Objects,
  getS3ObjectBytes,
  platformWatermarkKey,
  previewPhotoKey,
  putS3Object,
} from "~/server/s3";

const PREVIEW_MAX_WIDTH = 1600;
const PREVIEW_QUALITY = 65;

let watermarkCache: { bytes: Buffer; loadedAt: number } | null = null;
const CACHE_TTL_MS = 60_000; // re-fetch every minute in case admin updated it

async function loadPlatformWatermark(): Promise<Buffer | null> {
  if (watermarkCache && Date.now() - watermarkCache.loadedAt < CACHE_TTL_MS) {
    return watermarkCache.bytes;
  }
  try {
    const bytes = await getS3ObjectBytes(platformWatermarkKey());
    const buf = Buffer.from(bytes);
    watermarkCache = { bytes: buf, loadedAt: Date.now() };
    return buf;
  } catch {
    // No watermark uploaded yet — use the text fallback in buildComposite
    return null;
  }
}

/** Invalidate the in-process cache (e.g. after admin uploads a new watermark). */
export function invalidateWatermarkCache() {
  watermarkCache = null;
}

async function buildComposite(
  imageWidth: number,
  imageHeight: number,
): Promise<{ input: Buffer; tile: boolean; blend: "over" }> {
  const wm = await loadPlatformWatermark();

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
export async function generatePreview(photoId: string): Promise<string | null> {
  const photo = await db.photo.findUnique({
    where: { id: photoId },
    select: {
      id: true,
      eventId: true,
      ownerId: true,
      storageKey: true,
      previewKey: true,
    },
  });
  if (!photo) return null;

  let raw: Uint8Array;
  try {
    raw = await getS3ObjectBytes(photo.storageKey);
  } catch (err) {
    console.error("[watermark] download failed:", photo.storageKey, err);
    return null;
  }

  const buf = Buffer.from(raw);
  const meta = await sharp(buf).metadata();
  const w = meta.width ?? 1200;
  const h = meta.height ?? 800;

  try {
    const resized =
      w > PREVIEW_MAX_WIDTH
        ? await sharp(buf)
            .resize({ width: PREVIEW_MAX_WIDTH, withoutEnlargement: true })
            .toBuffer()
        : buf;
    const resizedMeta = w > PREVIEW_MAX_WIDTH ? await sharp(resized).metadata() : { width: w, height: h };

    const composite = await buildComposite(
      resizedMeta.width ?? w,
      resizedMeta.height ?? h,
    );

    const out = await sharp(resized)
      .composite([composite])
      .webp({ quality: PREVIEW_QUALITY })
      .toBuffer();

    // Delete any stale preview before writing the new one
    if (photo.previewKey) {
      await deleteS3Objects([photo.previewKey]).catch(() => undefined);
    }

    const key = previewPhotoKey(photo.ownerId, photo.eventId, photo.id);
    await putS3Object(key, out, "image/webp");

    await db.photo.update({
      where: { id: photo.id },
      data: { previewKey: key, previewGeneratedAt: new Date() },
    });

    return key;
  } catch (err) {
    console.error(`[watermark] error for photoId=${photo.id}:`, err);
    return null;
  }
}

/**
 * Generate previews for many photos sequentially. Used by the "Regenerate"
 * job after the admin updates the platform watermark.
 *
 * NOTE: runs sync for now. If the queue gets large we'll move it to a
 * background worker.
 */
export async function regeneratePreviewsForEvent(eventId: string): Promise<{
  done: number;
  failed: number;
}> {
  const photos = await db.photo.findMany({
    where: { eventId, fileSize: { not: null } },
    select: { id: true },
  });
  let done = 0;
  let failed = 0;
  for (const p of photos) {
    const ok = await generatePreview(p.id);
    if (ok) done++;
    else failed++;
  }
  return { done, failed };
}
