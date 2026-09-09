import "server-only";

import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { CloudFrontClient, CreateInvalidationCommand } from "@aws-sdk/client-cloudfront";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import https from "https";
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
  requestHandler: new NodeHttpHandler({
    httpsAgent: new https.Agent({ maxSockets: 300 }),
    /* Con tope de tiempo. El default del SDK es 0: sin límite.

       Un GetObject que se cuelga a mitad del stream no falla nunca, y como
       generatePreview toma el slot del semáforo ANTES de bajar y lo suelta en
       un finally, una sola descarga colgada se queda con uno de los tres slots
       para siempre. Tres de esas y el procesamiento de fotos se detiene sin un
       solo error en el log. Ya pasó en este VPS: scripts/rellenar-miniaturas.mjs
       tiene el mismo arreglo escrito a mano.

       socketTimeout es el que importa acá: requestTimeout sólo cubre hasta los
       encabezados, y lo que se cuelga es el cuerpo. */
    connectionTimeout: 10_000,
    requestTimeout: 60_000,
    socketTimeout: 60_000,
    throwOnRequestTimeout: true,
  }),
  ...(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
    ? {
        credentials: {
          accessKeyId: env.AWS_ACCESS_KEY_ID,
          secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
        },
      }
    : {}),
});

// ── CloudFront ────────────────────────────────────────────────────────────────

const cfCredentials =
  env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
    ? { accessKeyId: env.AWS_ACCESS_KEY_ID, secretAccessKey: env.AWS_SECRET_ACCESS_KEY }
    : undefined;

const cfClient = env.CLOUDFRONT_DISTRIBUTION_ID
  ? new CloudFrontClient({ region: "us-east-1", ...(cfCredentials ? { credentials: cfCredentials } : {}) })
  : null;

/** Returns a stable CloudFront URL for a key, or null if CF is not configured. */
export function getCFUrl(key: string): string | null {
  return env.CLOUDFRONT_DOMAIN ? `https://${env.CLOUDFRONT_DOMAIN}/${key}` : null;
}

/** Invalidates paths in CloudFront. Paths must start with /. Fire-and-forget safe. */
export async function createCFInvalidation(paths: string[]): Promise<void> {
  if (!cfClient || !env.CLOUDFRONT_DISTRIBUTION_ID || paths.length === 0) return;
  try {
    await cfClient.send(
      new CreateInvalidationCommand({
        DistributionId: env.CLOUDFRONT_DISTRIBUTION_ID,
        InvalidationBatch: {
          CallerReference: Date.now().toString(),
          Paths: { Quantity: paths.length, Items: paths },
        },
      }),
    );
  } catch (err) {
    console.error("[cloudfront] invalidation failed:", err);
  }
}

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

/** Unwatermarked preview, shown to the photographer in their dashboard. Same
 *  dimensions/quality as the watermarked preview but without the marca. */
/** La miniatura de la grilla. Vive al lado del preview, con otro prefijo. */
export function thumbPhotoKey(userId: string, eventId: string, photoId: string) {
  return `cuervito/users/${userId}/events/${eventId}/thumb/${photoId}.webp`;
}

export function previewCleanPhotoKey(userId: string, eventId: string, photoId: string) {
  return `${prefix}/users/${userId}/events/${eventId}/preview-clean/${photoId}.webp`;
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

export function storefrontLogoKey(userId: string) {
  return `${prefix}/users/${userId}/storefront-logo`;
}

export function eventCoverKey(userId: string, eventId: string, ext = "jpg") {
  return `${prefix}/users/${userId}/events/${eventId}/cover.${ext.replace(/^\./, "")}`;
}

/** Source image for an admin editor project (Level 1). */
export function editorSourceKey(userId: string, projectId: string, ext = "jpg") {
  return `${prefix}/users/${userId}/editor/${projectId}/source.${ext.replace(/^\./, "")}`;
}

/** An overlay layer's image asset within an editor project. */
export function editorLayerKey(
  userId: string,
  projectId: string,
  layerId: string,
  ext = "png",
) {
  return `${prefix}/users/${userId}/editor/${projectId}/layers/${layerId}.${ext.replace(/^\./, "")}`;
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
/**
 * Cuánto vale una URL firmada de subida.
 *
 * Eran 15 minutos, y ése era el techo de la subida: el navegador firmaba las
 * 2.000 fotos de una en los primeros segundos y los obreros las consumían en
 * orden, así que al llegar a la que se firmó hace más de 15 minutos S3 contesta
 * 403. Medido en producción: fotos de 14,9 MB a 3,9 MB/s entran ~235 en esa
 * ventana. Lotes de 220 llegaban enteros; de 286 se perdían 59. La fotógrafa
 * había aprendido a subir de a 220 sin saber por qué.
 *
 * Una hora es margen, no la solución: la solución es que el navegador firme de
 * a poco (ventana deslizante) para que ninguna URL espere. Con eso, la más
 * vieja de la ventana tiene minutos de edad y esta constante no se toca nunca.
 */
export const PRESIGN_SUBIDA_TTL_S = 60 * 60;

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

  const url = await getSignedUrl(s3, cmd, { expiresIn: opts.expiresIn ?? PRESIGN_SUBIDA_TTL_S });
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

export async function getS3ObjectBytes(
  key: string,
  opts?: { signal?: AbortSignal },
): Promise<Uint8Array> {
  if (!bucket) throw new Error("AWS_S3_BUCKET is not configured");
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }), { abortSignal: opts?.signal });
  const chunks: Uint8Array[] = [];
  for await (const chunk of res.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * Un día de caché para lo que se muestra: miniaturas, previews, portadas.
 *
 * Hoy los objetos suben SIN Cache-Control. CloudFront igual los cachea, pero el
 * navegador no recibe ninguna instrucción y revalida por su cuenta: volver atrás
 * en la galería o entrar de nuevo al rato vuelve a pagar la transferencia.
 *
 * Un día y no `immutable`: las claves de preview se REUSAN cuando el fotógrafo
 * cambia su marca de agua y se regeneran los derivados. Con immutable, esa marca
 * vieja se le quedaría congelada a los visitantes por un año.
 */
export const CACHE_MOSTRAR = "public, max-age=86400";

export async function putS3Object(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string,
  cacheControl?: string,
): Promise<void> {
  if (!bucket) throw new Error("AWS_S3_BUCKET is not configured");
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      ...(cacheControl ? { CacheControl: cacheControl } : {}),
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

/**
 * ¿Está el objeto en S3?
 *
 * Devuelve las TRES respuestas posibles y no dos, que es el punto. El catch
 * pelado de antes convertía un 503 de S3 —o un timeout, o credenciales
 * vencidas— en "no existe", y el commit usa esa respuesta para BORRAR la fila
 * de la foto. Con S3 teniendo un mal momento, eso borra fotos que sí llegaron.
 */
export async function headObject(
  key: string,
): Promise<{ estado: "existe"; size: number } | { estado: "no-existe" } | { estado: "error" }> {
  if (!bucket) return { estado: "error" };
  try {
    const res = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return { estado: "existe", size: res.ContentLength ?? 0 };
  } catch (err) {
    const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
    if (e.name === "NotFound" || e.$metadata?.httpStatusCode === 404) {
      return { estado: "no-existe" };
    }
    console.error("[s3] head falló:", key, e.name ?? err);
    return { estado: "error" };
  }
}

/** El tamaño, o null. Se queda por los llamadores que sólo quieren eso; los que
 *  toman decisiones destructivas tienen que usar headObject y mirar el estado. */
export async function getObjectSize(key: string): Promise<number | null> {
  const r = await headObject(key);
  return r.estado === "existe" ? r.size : null;
}
