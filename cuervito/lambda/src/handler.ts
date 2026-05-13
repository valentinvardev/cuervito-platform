/**
 * Cuervito · S3-triggered photo processor.
 *
 * Listens on s3:ObjectCreated:* for keys under `cuervito/users/.../events/.../original/`.
 * For each new photo:
 *   1. Find the Photo row in DB by storageKey.
 *   2. Run Rekognition DetectText for bib OCR.
 *   3. Run Rekognition IndexFaces against the event's collection.
 *   4. Persist results and bump RecognitionUsage for the owner.
 *
 * Keys outside the cuervito/ prefix are ignored so this Lambda can coexist
 * with the legacy SINCHI processor on the same bucket.
 */

import {
  S3Client,
  GetObjectCommand,
  type GetObjectCommandOutput,
} from "@aws-sdk/client-s3";
import {
  RekognitionClient,
  DetectTextCommand,
  IndexFacesCommand,
  CreateCollectionCommand,
  type TextDetection,
} from "@aws-sdk/client-rekognition";
import type { S3Event, S3Handler } from "aws-lambda";

import { PrismaClient } from "../generated/prisma";

const REGION = process.env.AWS_REGION ?? "us-east-2";
const PREFIX = process.env.CUERVITO_S3_PREFIX ?? "cuervito";

// Warm-container reuse
const s3 = new S3Client({ region: REGION });
const rekognition = new RekognitionClient({ region: REGION });
const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

type ParsedKey = { userId: string; eventId: string; photoId: string; ext: string };

/**
 * Expected: {PREFIX}/users/{userId}/events/{eventId}/original/{photoId}.{ext}
 */
function parseKey(key: string): ParsedKey | null {
  const parts = key.split("/");
  if (parts.length !== 7) return null;
  if (parts[0] !== PREFIX) return null;
  if (parts[1] !== "users") return null;
  if (parts[3] !== "events") return null;
  if (parts[5] !== "original") return null;
  const filename = parts[6]!;
  const dot = filename.lastIndexOf(".");
  if (dot < 0) return null;
  return {
    userId: parts[2]!,
    eventId: parts[4]!,
    photoId: filename.slice(0, dot),
    ext: filename.slice(dot + 1).toLowerCase(),
  };
}

function rekCollectionForEvent(eventId: string): string {
  // Letters, digits, _, ., - only
  return `cuervito-event-${eventId.replace(/[^a-zA-Z0-9_.\-]/g, "-")}`;
}

async function ensureCollection(id: string): Promise<void> {
  try {
    await rekognition.send(new CreateCollectionCommand({ CollectionId: id }));
  } catch (err: unknown) {
    if ((err as { name?: string }).name !== "ResourceAlreadyExistsException") throw err;
  }
}

async function downloadFromS3(bucket: string, key: string): Promise<Uint8Array> {
  const res: GetObjectCommandOutput = await s3.send(
    new GetObjectCommand({ Bucket: bucket, Key: key }),
  );
  const chunks: Uint8Array[] = [];
  for await (const chunk of res.Body as AsyncIterable<Uint8Array>) chunks.push(chunk);
  return Buffer.concat(chunks);
}

/**
 * Heuristic bib extraction from Rekognition DetectText results.
 * Ported from the SINCHI processor — favours short numeric strings that look
 * like race bibs (2–5 digits, isolated, high confidence).
 */
function extractBibs(detections: TextDetection[]): string | null {
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
      const lenScore = len === 3 ? 4 : len === 4 ? 5 : len === 2 ? 3 : len === 5 ? 2 : 1;
      const isolatedBonus = text === m ? 3 : 0;
      candidates.push({
        value: m,
        score: lenScore + isolatedBonus + confidence / 50,
      });
    }
  }
  if (candidates.length === 0) return null;

  const best = new Map<string, number>();
  for (const c of candidates) {
    if (!best.has(c.value) || best.get(c.value)! < c.score) best.set(c.value, c.score);
  }
  return Array.from(best.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([v]) => v)
    .join(",");
}

async function bumpRecognitionUsage(
  userId: string,
  kind: "ocr" | "index",
  amount = 1,
): Promise<void> {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  await prisma.recognitionUsage.upsert({
    where: { userId_year_month: { userId, year, month } },
    create: {
      userId,
      year,
      month,
      ocrCalls: kind === "ocr" ? amount : 0,
      indexedFaces: kind === "index" ? amount : 0,
      searchedFaces: 0,
    },
    update:
      kind === "ocr"
        ? { ocrCalls: { increment: amount } }
        : { indexedFaces: { increment: amount } },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Per-record processor
// ────────────────────────────────────────────────────────────────────────────

async function processRecord(bucket: string, key: string, sizeFromEvent: number) {
  const parsed = parseKey(key);
  if (!parsed) {
    console.log(`[lambda] ignoring non-cuervito key: ${key}`);
    return;
  }

  const photo = await prisma.photo.findUnique({
    where: { id: parsed.photoId },
    select: {
      id: true,
      eventId: true,
      ownerId: true,
      fileSize: true,
      ocrProcessedAt: true,
      faceProcessedAt: true,
    },
  });
  if (!photo) {
    console.warn(`[lambda] photo not found in DB: ${parsed.photoId}`);
    return;
  }

  // Belt-and-suspenders: keep file size in sync if commit didn't write it yet.
  if (!photo.fileSize && sizeFromEvent) {
    await prisma.photo
      .update({ where: { id: photo.id }, data: { fileSize: sizeFromEvent } })
      .catch(() => undefined);
  }

  const bytes = await downloadFromS3(bucket, key);

  // ── OCR ────────────────────────────────────────────────────────────────
  if (!photo.ocrProcessedAt) {
    try {
      const ocr = await rekognition.send(
        new DetectTextCommand({ Image: { Bytes: bytes } }),
      );
      const bibs = extractBibs(ocr.TextDetections ?? []);
      await prisma.photo.update({
        where: { id: photo.id },
        data: { bibNumbers: bibs, ocrProcessedAt: new Date() },
      });
      await bumpRecognitionUsage(photo.ownerId, "ocr", 1);
      console.log(`[lambda] OCR photoId=${photo.id} bibs=${bibs ?? "none"}`);
    } catch (err) {
      console.error(`[lambda] OCR failed for ${photo.id}:`, err);
    }
  }

  // ── Face index ─────────────────────────────────────────────────────────
  if (!photo.faceProcessedAt) {
    const collectionId = rekCollectionForEvent(photo.eventId);
    try {
      await ensureCollection(collectionId);

      const result = await rekognition.send(
        new IndexFacesCommand({
          CollectionId: collectionId,
          Image: { Bytes: bytes },
          ExternalImageId: photo.id,
          DetectionAttributes: [],
          MaxFaces: 10,
        }),
      );
      const faceRecords = result.FaceRecords ?? [];

      // Persist the rek collection id on the event the first time
      await prisma.event.update({
        where: { id: photo.eventId },
        data: { rekCollectionId: collectionId },
      }).catch(() => undefined);

      for (const fr of faceRecords) {
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
        await prisma.faceRecord.upsert({
          where: { rekFaceId: faceId },
          create: {
            rekFaceId: faceId,
            photoId: photo.id,
            eventId: photo.eventId,
            confidence: fr.Face?.Confidence ?? null,
            boundingBox: bbox ?? undefined,
          },
          update: {
            photoId: photo.id,
            eventId: photo.eventId,
            confidence: fr.Face?.Confidence ?? null,
            boundingBox: bbox ?? undefined,
          },
        });
      }

      await prisma.photo.update({
        where: { id: photo.id },
        data: { faceProcessedAt: new Date() },
      });

      if (faceRecords.length > 0) {
        await bumpRecognitionUsage(photo.ownerId, "index", faceRecords.length);
      }
      console.log(`[lambda] FaceIndex photoId=${photo.id} faces=${faceRecords.length}`);
    } catch (err) {
      console.error(`[lambda] FaceIndex failed for ${photo.id}:`, err);
    }
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Handler
// ────────────────────────────────────────────────────────────────────────────

export const handler: S3Handler = async (event: S3Event) => {
  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));
    const size = record.s3.object.size ?? 0;
    try {
      await processRecord(bucket, key, size);
    } catch (err) {
      // Rethrow so AWS retries (and eventually sends to DLQ if configured)
      console.error(`[lambda] processRecord failed for s3://${bucket}/${key}:`, err);
      throw err;
    }
  }
};
