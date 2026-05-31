import { NextResponse, type NextRequest } from "next/server";

import { env } from "~/env";
import { db } from "~/server/db";
import { deleteS3Objects } from "~/server/s3";

export const dynamic = "force-dynamic";

/**
 * Daily cleanup job. Called by the VPS' cron with
 *   Authorization: Bearer <CRON_SECRET>
 *
 * Two retention windows, both measured in days from now:
 *
 *  1. Photos soft-deleted more than PHOTO_RETENTION_DAYS ago are
 *     hard-deleted: their S3 objects are removed and the Photo row
 *     is removed too (SaleItems set photoId to null via onDelete).
 *
 *  2. Sales whose downloadTokenExpires is in the past have their
 *     downloadToken cleared so the link 404s. The Sale row stays
 *     so payouts/analytics keep working.
 *
 * We process in batches so a single invocation can't take down
 * the server even on a backlog.
 */
const BATCH_SIZE = 500;

export async function POST(req: NextRequest) {
  // ── auth ────────────────────────────────────────────────────────────────
  if (!env.CRON_SECRET) {
    return NextResponse.json(
      { error: "CRON_SECRET no configurado" },
      { status: 503 },
    );
  }
  const authHeader = req.headers.get("authorization") ?? "";
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const photoCutoff = new Date(
    now.getTime() - env.PHOTO_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  );

  // ── 1) Hard-delete soft-deleted photos past retention ───────────────────
  const stalePhotos = await db.photo.findMany({
    where: { deletedAt: { not: null, lt: photoCutoff } },
    take: BATCH_SIZE,
    select: { id: true, storageKey: true, previewKey: true, previewCleanKey: true },
  });

  let photosDeleted = 0;
  if (stalePhotos.length > 0) {
    const s3Keys = stalePhotos
      .flatMap((p) => [p.storageKey, p.previewKey, p.previewCleanKey])
      .filter((k): k is string => Boolean(k));

    // Best-effort S3 cleanup. If S3 fails, leave the DB rows so we retry
    // tomorrow instead of orphaning paid buyers' download attempts.
    try {
      // DeleteObjects caps at 1000 keys per call; BATCH_SIZE*2 ≤ 1000.
      await deleteS3Objects(s3Keys);
    } catch (err) {
      console.error("[cron cleanup] S3 delete failed:", err);
      return NextResponse.json(
        { error: "S3 delete failed", photosDeleted: 0 },
        { status: 502 },
      );
    }

    const result = await db.photo.deleteMany({
      where: { id: { in: stalePhotos.map((p) => p.id) } },
    });
    photosDeleted = result.count;
  }

  // ── 2) Expire stale download tokens ─────────────────────────────────────
  // Once expired we clear the token so /descarga 404s the link cleanly.
  // The expiry timestamp itself is also nulled so the row stops appearing
  // in "still downloadable" UIs.
  const expiredTokens = await db.sale.updateMany({
    where: {
      downloadToken: { not: null },
      downloadTokenExpires: { lt: now },
    },
    data: { downloadToken: null, downloadTokenExpires: null },
  });

  return NextResponse.json({
    photosDeleted,
    tokensExpired: expiredTokens.count,
    photoBacklogRemaining: stalePhotos.length === BATCH_SIZE,
  });
}
