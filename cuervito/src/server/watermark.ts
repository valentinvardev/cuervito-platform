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
  userWatermarkKey,
} from "~/server/s3";

const PREVIEW_MAX_WIDTH = 2400;
const PREVIEW_QUALITY = 85;

// ── Concurrency limiter ───────────────────────────────────────────────────────
// Sharp is CPU + memory intensive. Without a cap, uploading 50 photos at once
// fires 50 concurrent resize+watermark+S3-upload operations, which OOMs the
// VPS and produces 502s. Queue extras and process at most 3 at a time.
const MAX_CONCURRENT = 3;
let active = 0;
const waitQueue: Array<() => void> = [];

function acquireSlot(): Promise<void> {
  return new Promise((resolve) => {
    if (active < MAX_CONCURRENT) { active++; resolve(); }
    else waitQueue.push(() => { active++; resolve(); });
  });
}

function releaseSlot() {
  active--;
  waitQueue.shift()?.();
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
export async function generatePreview(photoId: string): Promise<string | null> {
  await acquireSlot();
  try {
    return await _generatePreview(photoId);
  } finally {
    releaseSlot();
  }
}

async function _generatePreview(photoId: string): Promise<string | null> {
  const photo = await db.photo.findUnique({
    where: { id: photoId },
    select: {
      id: true,
      eventId: true,
      ownerId: true,
      storageKey: true,
      previewKey: true,
      previewCleanKey: true,
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

    // 1) Clean preview — same dimensions/quality, no watermark. Shown to the
    //    photographer in their own dashboard so they don't see their own marca.
    const cleanOut = await sharp(resized)
      .webp({ quality: PREVIEW_QUALITY })
      .toBuffer();

    // 2) Watermarked preview — what the public sees on the storefront.
    const composite = await buildComposite(
      resizedMeta.width ?? w,
      resizedMeta.height ?? h,
      photo.ownerId,
    );
    const watermarkedOut = await sharp(resized)
      .composite([composite])
      .webp({ quality: PREVIEW_QUALITY })
      .toBuffer();

    // Delete stale previews before writing new ones
    const stale: string[] = [];
    if (photo.previewKey) stale.push(photo.previewKey);
    if (photo.previewCleanKey) stale.push(photo.previewCleanKey);
    if (stale.length > 0) {
      await deleteS3Objects(stale).catch(() => undefined);
    }

    const cleanKey = previewCleanPhotoKey(photo.ownerId, photo.eventId, photo.id);
    const watermarkedKey = previewPhotoKey(photo.ownerId, photo.eventId, photo.id);
    await Promise.all([
      putS3Object(cleanKey, cleanOut, "image/webp"),
      putS3Object(watermarkedKey, watermarkedOut, "image/webp"),
    ]);

    await db.photo.update({
      where: { id: photo.id },
      data: {
        previewKey: watermarkedKey,
        previewCleanKey: cleanKey,
        previewGeneratedAt: new Date(),
        width: resizedMeta.width ?? w,
        height: resizedMeta.height ?? h,
      },
    });

    return watermarkedKey;
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
  const event = await db.event.findUnique({ where: { id: eventId }, select: { ownerId: true } });
  const photos = await db.photo.findMany({
    where: { eventId, fileSize: { not: null }, deletedAt: null },
    select: { id: true },
  });
  let done = 0;
  let failed = 0;
  for (const p of photos) {
    const ok = await generatePreview(p.id);
    if (ok) done++;
    else failed++;
  }
  // Invalidate all previews for this event in CloudFront so stale cached
  // versions are replaced immediately after watermark regeneration.
  if (event?.ownerId && done > 0) {
    const wmSample = previewPhotoKey(event.ownerId, eventId, "x");
    const wmFolder = wmSample.substring(0, wmSample.lastIndexOf("/") + 1);
    const cleanSample = previewCleanPhotoKey(event.ownerId, eventId, "x");
    const cleanFolder = cleanSample.substring(0, cleanSample.lastIndexOf("/") + 1);
    void createCFInvalidation([`/${wmFolder}*`, `/${cleanFolder}*`]);
  }
  return { done, failed };
}
