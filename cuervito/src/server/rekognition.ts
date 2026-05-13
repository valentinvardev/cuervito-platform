import "server-only";

import {
  RekognitionClient,
  DetectTextCommand,
  IndexFacesCommand,
  CreateCollectionCommand,
  type TextDetection,
} from "@aws-sdk/client-rekognition";
import sharp from "sharp";

import { env } from "~/env";
import { db } from "~/server/db";
import { getS3ObjectBytes } from "~/server/s3";

const REKOGNITION_MAX_BYTES = 5 * 1024 * 1024;

export const rekognition = new RekognitionClient({
  region: env.AWS_REGION,
  ...(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
    ? {
        credentials: {
          accessKeyId: env.AWS_ACCESS_KEY_ID,
          secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
        },
      }
    : {}),
});

/** Build a Rekognition-safe collection id from an internal event id. */
export function rekCollectionForEvent(eventId: string): string {
  return `cuervito-event-${eventId.replace(/[^a-zA-Z0-9_.\-]/g, "-")}`;
}

async function ensureCollection(rekCollectionId: string): Promise<void> {
  try {
    await rekognition.send(new CreateCollectionCommand({ CollectionId: rekCollectionId }));
  } catch (err: unknown) {
    if ((err as { name?: string }).name !== "ResourceAlreadyExistsException") throw err;
  }
}

/** Compress image if over Rekognition's 5MB limit. */
async function loadForRekognition(storageKey: string): Promise<Uint8Array | null> {
  try {
    const rawBytes = await getS3ObjectBytes(storageKey);
    if (rawBytes.byteLength <= REKOGNITION_MAX_BYTES) return rawBytes;
    const compressed = await sharp(Buffer.from(rawBytes))
      .resize({ width: 1920, withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
    return new Uint8Array(compressed);
  } catch (err) {
    console.error("[rekognition] download failed:", storageKey, err);
    return null;
  }
}

/* =============================================================================
 * OCR — bib number extraction
 * Ported from SINCHI (_ref-pp3). Heuristics: 2–5 digit numbers, prefers
 * isolated and 3–4 char strings, drops common false positives (times, "km").
 * ===========================================================================*/

function extractAllBibs(detections: TextDetection[]): string[] {
  const candidates: { value: string; score: number }[] = [];

  for (const d of detections) {
    if (d.Type !== "LINE") continue;
    const text = (d.DetectedText ?? "").trim();
    const confidence = d.Confidence ?? 0;
    if (confidence < 50) continue;

    const matches = text.match(/\b\d{2,5}\b/g) ?? [];
    for (const m of matches) {
      if (/^\d{1,2}:\d{2}/.test(text)) continue; // times
      if (text.includes("%")) continue;
      if (/^\d+\s*km$/i.test(text)) continue;
      if (parseInt(m) > 99999) continue;

      const len = m.length;
      const lenScore =
        len === 3 ? 4 : len === 4 ? 5 : len === 2 ? 3 : len === 5 ? 2 : 1;
      const isolatedBonus = text === m ? 3 : 0;
      const confBonus = confidence / 50;
      candidates.push({ value: m, score: lenScore + isolatedBonus + confBonus });
    }
  }
  if (candidates.length === 0) return [];

  const best = new Map<string, number>();
  for (const c of candidates) {
    if (!best.has(c.value) || best.get(c.value)! < c.score) best.set(c.value, c.score);
  }
  return Array.from(best.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([v]) => v);
}

/** Run DetectText against a single photo, store bibs as comma-separated. */
export async function runOcr(photoId: string): Promise<{ bibs: string | null }> {
  const photo = await db.photo.findUnique({
    where: { id: photoId },
    select: { id: true, storageKey: true, bibNumbers: true, ownerId: true },
  });
  if (!photo) return { bibs: null };
  if (photo.bibNumbers !== null) return { bibs: photo.bibNumbers };

  const imageBytes = await loadForRekognition(photo.storageKey);
  if (!imageBytes) return { bibs: null };

  try {
    const response = await rekognition.send(
      new DetectTextCommand({ Image: { Bytes: imageBytes } }),
    );
    const bibs = extractAllBibs(response.TextDetections ?? []);

    console.log(`[OCR] photoId=${photoId} bibs=${bibs.join(",") || "none"}`);

    const bibString = bibs.length > 0 ? bibs.join(",") : null;
    await db.photo.update({
      where: { id: photoId },
      data: { bibNumbers: bibString, ocrProcessedAt: new Date() },
    });

    // Track quota usage
    await bumpRecognitionUsage(photo.ownerId, "ocr", 1).catch(() => undefined);

    return { bibs: bibString };
  } catch (err) {
    console.error(`[OCR] Rekognition error for photoId=${photoId}:`, err);
    return { bibs: null };
  }
}

/* =============================================================================
 * Face indexing
 * ===========================================================================*/

export async function runFaceIndex(photoId: string, eventId: string): Promise<void> {
  const photo = await db.photo.findUnique({
    where: { id: photoId },
    select: { id: true, storageKey: true, ownerId: true },
  });
  if (!photo) return;

  const imageBytes = await loadForRekognition(photo.storageKey);
  if (!imageBytes) return;

  const rekCollectionId = rekCollectionForEvent(eventId);

  try {
    await ensureCollection(rekCollectionId);

    const result = await rekognition.send(
      new IndexFacesCommand({
        CollectionId: rekCollectionId,
        Image: { Bytes: imageBytes },
        ExternalImageId: photoId,
        DetectionAttributes: [],
        MaxFaces: 10,
      }),
    );

    const indexed = result.FaceRecords ?? [];
    console.log(`[FaceIndex] photoId=${photoId} indexed ${indexed.length} faces`);

    // Persist the rek collection id on the event the first time
    await db.event
      .update({ where: { id: eventId }, data: { rekCollectionId } })
      .catch(() => undefined);

    for (const fr of indexed) {
      const faceId = fr.Face?.FaceId;
      if (!faceId) continue;
      const bbox = fr.Face?.BoundingBox
        ? {
            left: fr.Face.BoundingBox.Left ?? null,
            top: fr.Face.BoundingBox.Top ?? null,
            width: fr.Face.BoundingBox.Width ?? null,
            height: fr.Face.BoundingBox.Height ?? null,
          }
        : null;
      await db.faceRecord.upsert({
        where: { rekFaceId: faceId },
        update: {
          photoId,
          eventId,
          confidence: fr.Face?.Confidence ?? null,
          boundingBox: bbox ?? undefined,
        },
        create: {
          rekFaceId: faceId,
          photoId,
          eventId,
          confidence: fr.Face?.Confidence ?? null,
          boundingBox: bbox ?? undefined,
        },
      });
    }

    await db.photo.update({
      where: { id: photoId },
      data: { faceProcessedAt: new Date() },
    });

    if (indexed.length > 0) {
      await bumpRecognitionUsage(photo.ownerId, "index", indexed.length).catch(
        () => undefined,
      );
    }
  } catch (err) {
    console.error(`[FaceIndex] Rekognition error for photoId=${photoId}:`, err);
  }
}

/* =============================================================================
 * Usage tracking
 * ===========================================================================*/

async function bumpRecognitionUsage(
  userId: string,
  kind: "ocr" | "index" | "search",
  amount: number,
): Promise<void> {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  await db.recognitionUsage.upsert({
    where: { userId_year_month: { userId, year, month } },
    create: {
      userId,
      year,
      month,
      ocrCalls: kind === "ocr" ? amount : 0,
      indexedFaces: kind === "index" ? amount : 0,
      searchedFaces: kind === "search" ? amount : 0,
    },
    update:
      kind === "ocr"
        ? { ocrCalls: { increment: amount } }
        : kind === "index"
          ? { indexedFaces: { increment: amount } }
          : { searchedFaces: { increment: amount } },
  });
}

export { bumpRecognitionUsage };
