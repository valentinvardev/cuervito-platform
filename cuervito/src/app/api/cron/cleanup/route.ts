import { NextResponse, type NextRequest } from "next/server";

import { env } from "~/env";
import { barrerHuerfanas } from "~/server/cola-fotos";
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

  /* ── 1) Las subidas que se firmaron y nunca llegaron ─────────────────────
     Va PRIMERO y no después del borrado de fotos vencidas. Estaba abajo, y el
     paso de abajo devuelve 502 si S3 falla: un mal día de S3 salteaba esta
     limpieza entera. Con 1.658 filas acumuladas y la regla de 24 horas ya
     escrita en el código, es la explicación más probable.

     Y ya no borra a ciegas. El deleteMany de antes no le preguntaba a S3 si el
     objeto existía: si existía, la fila se iba y el archivo quedaba pagando
     storage sin nada que lo referencie. barrerHuerfanas pregunta y decide:
     adopta la que llegó tarde, borra la fila Y el objeto de la que ya nadie va
     a reclamar, y no toca nada si S3 no contesta. */
  const huerfanas = await barrerHuerfanas();

  // ── 2) Hard-delete soft-deleted photos past retention ───────────────────
  const stalePhotos = await db.photo.findMany({
    where: { deletedAt: { not: null, lt: photoCutoff } },
    take: BATCH_SIZE,
    select: {
      id: true,
      storageKey: true,
      previewKey: true,
      previewCleanKey: true,
      // La miniatura también: sin esto queda en el bucket sin dueño.
      thumbKey: true,
    },
  });

  let photosDeleted = 0;
  if (stalePhotos.length > 0) {
    const s3Keys = stalePhotos
      .flatMap((p) => [p.storageKey, p.previewKey, p.previewCleanKey, p.thumbKey])
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

  // ── 3) Expire stale download tokens ─────────────────────────────────────
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

  /* Queda anotado cuándo corrió.

     Sin esta marca no hay forma de saber si el crontab del VPS existe de
     verdad, y las 1.658 filas acumuladas con la regla de 24 horas ya en el
     código sugieren bastante que no corría. */
  await db.setting
    .upsert({
      where: { key: "cron:cleanup:ultimaCorrida" },
      create: { key: "cron:cleanup:ultimaCorrida", value: now.toISOString() },
      update: { value: now.toISOString() },
    })
    .catch(() => undefined);

  return NextResponse.json({
    photosDeleted,
    huerfanas,
    tokensExpired: expiredTokens.count,
    photoBacklogRemaining: stalePhotos.length === BATCH_SIZE,
  });
}
