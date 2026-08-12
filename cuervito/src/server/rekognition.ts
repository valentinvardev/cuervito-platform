import "server-only";

import {
  RekognitionClient,
  DetectTextCommand,
  IndexFacesCommand,
  CreateCollectionCommand,
  DeleteCollectionCommand,
  type TextDetection,
} from "@aws-sdk/client-rekognition";
import sharp from "sharp";

import { env } from "~/env";
import { db } from "~/server/db";
import { hasRecognitionQuota, incrementRecognitionUsage } from "~/server/quotas";
import { getS3ObjectBytes } from "~/server/s3";

const REKOGNITION_MAX_BYTES = 5 * 1024 * 1024;

/**
 * Envoltorio de toda llamada facturable a Rekognition.
 *
 * Hace tres cosas que antes no hacía nadie:
 *
 *  1. Cuenta la llamada ANTES de hacerla. Si la imagen se procesó, se pagó,
 *     aunque después falle la respuesta o no encuentre ninguna cara. Los
 *     contadores viejos sólo sumaban cuando había resultado, así que
 *     subestimaban la factura justo en los casos raros.
 *  2. Deja una línea de log estructurada por llamada, con la plataforma
 *     adelante. La cuenta de AWS es compartida y CloudTrail no puede atribuir
 *     DetectText (sus requestParameters son `{"image":{}}`), así que este log
 *     es el único lugar donde queda registrado qué foto generó qué llamada.
 *  3. Mide cuánto tardó, para poder cruzar contra los timeouts de la Lambda.
 */
async function billedCall<T>(
  op: "DetectText" | "IndexFaces" | "SearchFacesByImage",
  meta: { ownerId: string; photoId?: string; eventId?: string },
  kind: "ocr" | "indexRequest" | "search",
  run: () => Promise<T>,
): Promise<T> {
  const tag = `[rek] platform=cuervito op=${op} owner=${meta.ownerId}${
    meta.photoId ? ` photo=${meta.photoId}` : ""
  }${meta.eventId ? ` event=${meta.eventId}` : ""}`;

  await incrementRecognitionUsage(meta.ownerId, kind, 1).catch(() => undefined);
  console.log(`${tag} state=start`);

  const started = Date.now();
  try {
    const out = await run();
    console.log(`${tag} state=ok ms=${Date.now() - started}`);
    return out;
  } catch (err) {
    const name = (err as { name?: string }).name ?? "Error";
    console.log(`${tag} state=error err=${name} ms=${Date.now() - started}`);
    throw err;
  }
}

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

// In-memory cache of collection IDs that we've already created (or that
// already existed). Prevents calling CreateCollection on every IndexFaces
// call — previously that fired ~once per photo (7,924 times in May 2026).
const ensuredCollections = new Set<string>();

async function ensureCollection(rekCollectionId: string): Promise<void> {
  if (ensuredCollections.has(rekCollectionId)) return;
  try {
    await rekognition.send(new CreateCollectionCommand({ CollectionId: rekCollectionId }));
    ensuredCollections.add(rekCollectionId);
  } catch (err: unknown) {
    if ((err as { name?: string }).name === "ResourceAlreadyExistsException") {
      // Already exists — mark as ensured so we never call CreateCollection
      // again for this id in the current process.
      ensuredCollections.add(rekCollectionId);
      return;
    }
    throw err;
  }
}

/** Delete a Rekognition collection (and every face inside it). No-op if the
 *  collection was never created. Called on hard-delete of an event. */
export async function deleteRekCollection(rekCollectionId: string): Promise<void> {
  try {
    await rekognition.send(new DeleteCollectionCommand({ CollectionId: rekCollectionId }));
  } catch (err: unknown) {
    if ((err as { name?: string }).name === "ResourceNotFoundException") return;
    throw err;
  } finally {
    ensuredCollections.delete(rekCollectionId);
  }
}

/** Camino de respaldo: baja el original de S3 y lo comprime si supera el
 *  límite de 5MB de Rekognition.
 *
 *  Solo se usa cuando el llamador no pudo pasar bytes ya preparados —
 *  reprocesos manuales, fotos legacy, o cuando generatePreview falló. En
 *  el camino normal de subida los bytes llegan por parámetro y esto no
 *  se ejecuta: evita dos descargas del original (~30MB por foto) y dos
 *  resizes con sharp. */
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
export async function runOcr(
  photoId: string,
  /** JPEG ya preparado por generatePreview. Si no viene, se baja el original. */
  preparedBytes?: Uint8Array | null,
): Promise<{ bibs: string | null }> {
  const photo = await db.photo.findUnique({
    where: { id: photoId },
    select: {
      id: true,
      storageKey: true,
      bibNumbers: true,
      ocrProcessedAt: true,
      ownerId: true,
    },
  });
  if (!photo) return { bibs: null };

  // El corte va contra `ocrProcessedAt`, no contra `bibNumbers`. Antes miraba
  // los dorsales, y cuando el OCR no encontraba ninguno esa columna quedaba en
  // null: el guard no cortaba nunca y esas fotos se volvían a procesar (y a
  // pagar) en cada reintento. Eran ~6.000 fotos, el 27% de las llamadas.
  if (photo.ocrProcessedAt) return { bibs: photo.bibNumbers };

  if (!(await hasRecognitionQuota(photo.ownerId, 1))) {
    console.warn(`[OCR] cuota mensual agotada owner=${photo.ownerId} photo=${photoId}`);
    return { bibs: null };
  }

  // Reserva atómica. El endpoint de commit y la Lambda de S3 corren sobre la
  // misma foto casi al mismo tiempo: sin esto los dos leen null y los dos
  // pagan. Sólo el UPDATE que encuentra la fila todavía en null se queda con
  // el trabajo.
  const claimedAt = new Date();
  const claim = await db.photo.updateMany({
    where: { id: photoId, ocrProcessedAt: null },
    data: { ocrProcessedAt: claimedAt },
  });
  if (claim.count === 0) {
    const fresh = await db.photo.findUnique({
      where: { id: photoId },
      select: { bibNumbers: true },
    });
    return { bibs: fresh?.bibNumbers ?? null };
  }

  // Devuelve la foto a la cola si no llegamos a procesarla. El `where` incluye
  // la marca propia para no pisar una reserva ajena.
  const release = () =>
    db.photo
      .updateMany({
        where: { id: photoId, ocrProcessedAt: claimedAt },
        data: { ocrProcessedAt: null },
      })
      .catch(() => undefined);

  const imageBytes =
    preparedBytes ?? (await loadForRekognition(photo.storageKey));
  if (!imageBytes) {
    await release();
    return { bibs: null };
  }

  try {
    const response = await billedCall(
      "DetectText",
      { ownerId: photo.ownerId, photoId },
      "ocr",
      () => rekognition.send(new DetectTextCommand({ Image: { Bytes: imageBytes } })),
    );
    const bibs = extractAllBibs(response.TextDetections ?? []);

    console.log(`[OCR] photoId=${photoId} bibs=${bibs.join(",") || "none"}`);

    const bibString = bibs.length > 0 ? bibs.join(",") : null;
    await db.photo.update({
      where: { id: photoId },
      data: { bibNumbers: bibString },
    });

    return { bibs: bibString };
  } catch (err) {
    console.error(`[OCR] Rekognition error for photoId=${photoId}:`, err);
    await release();
    return { bibs: null };
  }
}

/* =============================================================================
 * Face indexing
 * ===========================================================================*/

export async function runFaceIndex(
  photoId: string,
  eventId: string,
  /** JPEG ya preparado por generatePreview. Si no viene, se baja el original. */
  preparedBytes?: Uint8Array | null,
): Promise<void> {
  const photo = await db.photo.findUnique({
    where: { id: photoId },
    select: { id: true, storageKey: true, ownerId: true, faceProcessedAt: true },
  });
  if (!photo) return;
  // Already indexed — skip. Without this guard, retries or accidental double
  // invocations re-index the photo and charge for IndexFaces again.
  if (photo.faceProcessedAt) return;

  if (!(await hasRecognitionQuota(photo.ownerId, 1))) {
    console.warn(`[FaceIndex] cuota mensual agotada owner=${photo.ownerId} photo=${photoId}`);
    return;
  }

  // Misma reserva atómica que en runOcr: el guard de arriba resuelve el caso
  // secuencial, esto resuelve la carrera con la Lambda. Indexar dos veces la
  // misma imagen no sólo se paga dos veces — AWS devuelve FaceIds distintos y
  // las caras duplicadas quedan guardadas para siempre.
  const claimedAt = new Date();
  const claim = await db.photo.updateMany({
    where: { id: photoId, faceProcessedAt: null },
    data: { faceProcessedAt: claimedAt },
  });
  if (claim.count === 0) return;

  const release = () =>
    db.photo
      .updateMany({
        where: { id: photoId, faceProcessedAt: claimedAt },
        data: { faceProcessedAt: null },
      })
      .catch(() => undefined);

  const imageBytes =
    preparedBytes ?? (await loadForRekognition(photo.storageKey));
  if (!imageBytes) {
    await release();
    return;
  }

  const rekCollectionId = rekCollectionForEvent(eventId);

  try {
    await ensureCollection(rekCollectionId);

    const result = await billedCall(
      "IndexFaces",
      { ownerId: photo.ownerId, photoId, eventId },
      "indexRequest",
      () =>
        rekognition.send(
          new IndexFacesCommand({
            CollectionId: rekCollectionId,
            Image: { Bytes: imageBytes },
            ExternalImageId: photoId,
            DetectionAttributes: [],
            MaxFaces: 10,
          }),
        ),
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

    // `faceProcessedAt` ya quedó puesto por la reserva de arriba; acá sólo se
    // registra cuántas caras salieron, que es un resultado y no una unidad
    // facturable (la llamada la contó billedCall).
    if (indexed.length > 0) {
      await bumpRecognitionUsage(photo.ownerId, "index", indexed.length).catch(
        () => undefined,
      );
    }
  } catch (err) {
    console.error(`[FaceIndex] Rekognition error for photoId=${photoId}:`, err);
    await release();
  }
}

/* =============================================================================
 * Usage tracking
 * ===========================================================================*/

/**
 * Se mantiene el nombre porque lo importa la ruta de face-search, pero la
 * implementación es una sola y vive en quotas.ts. Antes había dos copias del
 * mismo upsert y no coincidían: ésta usaba UTC y la de quotas.ts hora local,
 * así que cerca del cambio de mes escribían en filas distintas.
 */
async function bumpRecognitionUsage(
  userId: string,
  kind: "ocr" | "index" | "indexRequest" | "search",
  amount: number,
): Promise<void> {
  await incrementRecognitionUsage(userId, kind, amount);
}

export { billedCall, bumpRecognitionUsage };
