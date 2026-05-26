import "server-only";

import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { env } from "~/env";

const region = env.AWS_REGION;
const bucket = env.AWS_S3_BUCKET;
const prefix = env.AWS_S3_PREFIX; // "cuervito"

if (!bucket) {
  console.warn("[s3] AWS_S3_BUCKET not configured — uploads will fail.");
}

export const s3 = new S3Client({
  region,
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
  useAccelerateEndpoint: env.AWS_S3_ACCELERATE,
  // Default pool is 50 sockets. Bulk uploads trigger many concurrent
  // watermark downloads which exhausted the pool and caused ECONNRESET.
  // 300 gives plenty of headroom even before the semaphore in watermark.ts
  // kicks in.
  requestHandler: new NodeHttpHandler({ maxSockets: 300 }),
  ...(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
    ? {
        credentials: {
          accessKeyId: env.AWS_ACCESS_KEY_ID,
          secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
        },
      }
    : {}),
});

/* ----------------------------------------------------------------------------
 * Key helpers
 *
 * Layout inside the shared bucket:
 *   cuervito/users/{userId}/avatar.{ext}
 *   cuervito/users/{userId}/watermark.png
 *   cuervito/users/{userId}/events/{eventId}/original/{photoId}.{ext}
 *   cuervito/users/{userId}/events/{eventId}/preview/{photoId}.webp
 * -------------------------------------------------------------------------- */

export function originalPhotoKey(userId: string, eventId: string, photoId: string, ext: string) {
  return `${prefix}/users/${userId}/events/${eventId}/original/${photoId}.${ext.replace(/^\./, "")}`;
}

export function previewPhotoKey(userId: string, eventId: string, photoId: string) {
  return `${prefix}/users/${userId}/events/${eventId}/preview/${photoId}.webp`;
}

/** Per-user watermark (unused — superseded by the global platform watermark). */
export function userWatermarkKey(userId: string) {
  return `${prefix}/users/${userId}/watermark.png`;
}

/** Global, admin-controlled watermark applied to every preview. */
export function platformWatermarkKey() {
  return `${prefix}/_platform/watermark.png`;
}

export function avatarKey(userId: string, ext = "jpg") {
  return `${prefix}/users/${userId}/avatar.${ext.replace(/^\./, "")}`;
}

export function eventCoverKey(userId: string, eventId: string, ext = "jpg") {
  return `${prefix}/users/${userId}/events/${eventId}/cover.${ext.replace(/^\./, "")}`;
}

/** True if a key is one of ours (lives under the cuervito/ prefix). */
export function isCuervitoKey(key: string): boolean {
  return key.startsWith(`${prefix}/`);
}

/* ----------------------------------------------------------------------------
 * Presigned URLs
 * -------------------------------------------------------------------------- */

/**
 * Generates a presigned PUT URL. Client uploads directly to S3 — does not pass
 * through our server. The browser must send the file as the request body with
 * the matching Content-Type header.
 */
export async function getPresignedUploadUrl(opts: {
  key: string;
  contentType: string;
  contentLength: number;
  expiresIn?: number;
}): Promise<{ url: string; key: string }> {
  if (!bucket) throw new Error("AWS_S3_BUCKET is not configured");

  const cmd = new PutObjectCommand({
    Bucket: bucket,
    Key: opts.key,
    ContentType: opts.contentType,
    ContentLength: opts.contentLength,
  });

  const url = await getSignedUrl(s3, cmd, { expiresIn: opts.expiresIn ?? 60 * 15 });
  return { url, key: opts.key };
}

/** Presigned GET for downloading (e.g. originals after purchase). */
export async function getPresignedDownloadUrl(
  key: string,
  opts: { expiresIn?: number; filename?: string } = {},
): Promise<string> {
  if (!bucket) throw new Error("AWS_S3_BUCKET is not configured");

  const cmd = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    ...(opts.filename
      ? { ResponseContentDisposition: `attachment; filename="${opts.filename}"` }
      : {}),
  });

  return getSignedUrl(s3, cmd, { expiresIn: opts.expiresIn ?? 60 * 60 });
}

/* ----------------------------------------------------------------------------
 * Server-side IO (used by the watermark pipeline and admin tools)
 * -------------------------------------------------------------------------- */

export async function getS3ObjectBytes(key: string): Promise<Uint8Array> {
  if (!bucket) throw new Error("AWS_S3_BUCKET is not configured");
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const chunks: Uint8Array[] = [];
  for await (const chunk of res.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function putS3Object(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string,
): Promise<void> {
  if (!bucket) throw new Error("AWS_S3_BUCKET is not configured");
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

export async function deleteS3Objects(keys: string[]): Promise<void> {
  if (!bucket || keys.length === 0) return;
  await s3.send(
    new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: { Objects: keys.map((k) => ({ Key: k })) },
    }),
  );
}

/** Returns the size of an object in bytes, or null if not found. */
export async function getObjectSize(key: string): Promise<number | null> {
  if (!bucket) return null;
  try {
    const res = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return res.ContentLength ?? null;
  } catch {
    return null;
  }
}
