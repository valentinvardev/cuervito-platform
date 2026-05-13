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

/** Increment the per-user monthly recognition counter. */
export async function incrementRecognitionUsage(
  userId: string,
  kind: "index" | "search" | "ocr",
  amount = 1,
): Promise<void> {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const updates: { indexedFaces?: number; searchedFaces?: number; ocrCalls?: number } = {};
  if (kind === "index") updates.indexedFaces = amount;
  if (kind === "search") updates.searchedFaces = amount;
  if (kind === "ocr") updates.ocrCalls = amount;

  await db.recognitionUsage.upsert({
    where: { userId_year_month: { userId, year, month } },
    create: {
      userId,
      year,
      month,
      indexedFaces: kind === "index" ? amount : 0,
      searchedFaces: kind === "search" ? amount : 0,
      ocrCalls: kind === "ocr" ? amount : 0,
    },
    update: {
      ...(kind === "index" && { indexedFaces: { increment: amount } }),
      ...(kind === "search" && { searchedFaces: { increment: amount } }),
      ...(kind === "ocr" && { ocrCalls: { increment: amount } }),
    },
  });
}

