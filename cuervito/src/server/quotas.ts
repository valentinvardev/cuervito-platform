import "server-only";

import { env } from "~/env";
import { formatBytes, type QuotaUsage } from "~/lib/quotas-shared";
import { db } from "~/server/db";

export { formatBytes, type QuotaUsage };

/**
 * Read storage + recognition quota & usage for a user.
 * Storage is computed from Photo.fileSize sum.
 * Recognitions is the current calendar month's RecognitionUsage row.
 */
export async function getQuotaUsage(userId: string): Promise<QuotaUsage> {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1–12

  const [user, storageAgg, usage] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: { storageQuotaBytes: true, recognitionQuotaMonthly: true },
    }),
    db.photo.aggregate({
      where: { ownerId: userId },
      _sum: { fileSize: true },
    }),
    db.recognitionUsage.findUnique({
      where: { userId_year_month: { userId, year, month } },
      select: { indexedFaces: true, searchedFaces: true, ocrCalls: true },
    }),
  ]);

  const storageLimit = user?.storageQuotaBytes ?? BigInt(env.QUOTA_STORAGE_BYTES_DEFAULT);
  const storageUsed = BigInt(storageAgg._sum.fileSize ?? 0);
  const storagePct =
    storageLimit > 0n ? Number((storageUsed * 100n) / storageLimit) : 0;

  const recLimit = user?.recognitionQuotaMonthly ?? env.QUOTA_RECOGNITION_MONTHLY_DEFAULT;
  const recUsed =
    (usage?.indexedFaces ?? 0) + (usage?.searchedFaces ?? 0) + (usage?.ocrCalls ?? 0);
  const recPct = recLimit > 0 ? Math.round((recUsed / recLimit) * 100) : 0;

  return {
    storage: {
      usedBytes: storageUsed,
      limitBytes: storageLimit,
      pct: storagePct,
      overrideActive: user?.storageQuotaBytes !== null && user?.storageQuotaBytes !== undefined,
    },
    recognitions: {
      used: recUsed,
      limit: recLimit,
      pct: recPct,
      overrideActive: user?.recognitionQuotaMonthly !== null && user?.recognitionQuotaMonthly !== undefined,
      year,
      month,
    },
  };
}

/** Throws if the user is at or above the storage limit. */
export async function assertStorageQuota(userId: string, addingBytes: number): Promise<void> {
  const q = await getQuotaUsage(userId);
  const projected = q.storage.usedBytes + BigInt(addingBytes);
  if (projected > q.storage.limitBytes) {
    throw new Error(
      `Storage quota exceeded: would use ${projected} of ${q.storage.limitBytes} bytes.`,
    );
  }
}

/** Throws if the user is at or above the monthly recognition limit. */
export async function assertRecognitionQuota(userId: string, adding = 1): Promise<void> {
  const q = await getQuotaUsage(userId);
  if (q.recognitions.used + adding > q.recognitions.limit) {
    throw new Error(
      `Recognition quota exceeded for ${q.recognitions.year}-${q.recognitions.month}: ${q.recognitions.used + adding} of ${q.recognitions.limit}.`,
    );
  }
}

/**
 * Estado de la cuota de reconocimiento, sin tocar el agregado de storage.
 *
 * `getQuotaUsage` suma `fileSize` sobre todas las fotos del usuario, y esto
 * corre en el camino caliente de cada foto que se sube: pagar ese scan por
 * foto no tiene sentido. Acá van dos lecturas indexadas y nada más.
 */
export async function recognitionQuotaState(
  userId: string,
): Promise<{ used: number; limit: number }> {
  const now = new Date();
  const [user, usage] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: { recognitionQuotaMonthly: true },
    }),
    db.recognitionUsage.findUnique({
      where: {
        userId_year_month: {
          userId,
          year: now.getUTCFullYear(),
          month: now.getUTCMonth() + 1,
        },
      },
      select: { indexRequests: true, searchedFaces: true, ocrCalls: true },
    }),
  ]);

  // Se mide contra LLAMADAS facturables, no contra caras encontradas: es lo
  // que aparece en la factura de AWS.
  const used =
    (usage?.indexRequests ?? 0) +
    (usage?.searchedFaces ?? 0) +
    (usage?.ocrCalls ?? 0);

  return {
    used,
    limit: user?.recognitionQuotaMonthly ?? env.QUOTA_RECOGNITION_MONTHLY_DEFAULT,
  };
}

/**
 * Cortacircuitos de costo, distinto de la cuota comercial.
 *
 * `QUOTA_RECOGNITION_MONTHLY_DEFAULT` (10.000) es lo que muestra el panel, y
 * hoy el fotógrafo principal lo pasa todos los meses: usarlo para frenar
 * llamadas le cortaría las subidas. Este tope es otra cosa — está para que un
 * bucle o un abuso no se lleven puesta la factura, así que vive en su propia
 * variable y arranca en 5× el pico real observado.
 *
 * Devuelve un booleano en vez de tirar: quien llama degrada (la foto se sube
 * igual, sin dorsal ni caras) en lugar de romper la subida. Un techo de costo
 * no debería poder dejar a un fotógrafo sin trabajar en el medio de un evento.
 */
export async function hasRecognitionQuota(userId: string, adding = 1): Promise<boolean> {
  const { used } = await recognitionQuotaState(userId);
  return used + adding <= env.RECOGNITION_HARD_CAP_MONTHLY;
}

/** Increment the per-user monthly recognition counter.
 *
 *  UTC a propósito: la Lambda y el server tienen que caer en el mismo mes.
 *  Antes esta función usaba hora local y la de `rekognition.ts` usaba UTC, así
 *  que cerca del cambio de mes escribían en filas distintas. */
export async function incrementRecognitionUsage(
  userId: string,
  kind: "index" | "indexRequest" | "search" | "ocr",
  amount = 1,
): Promise<void> {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;

  const column =
    kind === "index"
      ? "indexedFaces"
      : kind === "indexRequest"
        ? "indexRequests"
        : kind === "search"
          ? "searchedFaces"
          : "ocrCalls";

  await db.recognitionUsage.upsert({
    where: { userId_year_month: { userId, year, month } },
    create: { userId, year, month, [column]: amount },
    update: { [column]: { increment: amount } },
  });
}

