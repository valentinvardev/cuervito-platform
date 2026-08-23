import "server-only";

import { revalidateTag } from "next/cache";

import { db } from "~/server/db";
import { deleteRekCollection } from "~/server/rekognition";
import { deleteS3Objects } from "~/server/s3";

/**
 * Lo que comparten el panel actual y /v2 sobre eventos.
 *
 * Está en un módulo normal y NO en actions.ts a propósito. Todo lo que se
 * exporta desde un archivo con "use server" queda publicado como endpoint que
 * cualquiera puede llamar desde el navegador, y purgarEvento recibe el userId
 * como parámetro: exportado desde ahí, alcanzaba con llamarlo con el id de otro
 * para borrarle un evento. Acá adentro, en cambio, sólo lo puede usar código
 * del servidor, y quien lo llama es el que ya comprobó la sesión.
 *
 * El "server-only" de arriba hace que el error sea de compilación y no un
 * descubrimiento, si alguna vez alguien lo importa desde un componente cliente.
 */

export function busUserDashboardCache(userId: string) {
  revalidateTag(`user:${userId}:dashboard`);
  revalidateTag(`user:${userId}:events`);
  revalidateTag(`user:${userId}:quota`);
}

export function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function uniqueSlug(base: string, userId: string, ignoreId?: string): Promise<string> {
  let slug = base || "evento";
  for (let i = 1; i < 100; i++) {
    const taken = await db.event.findFirst({
      where: { slug, ownerId: userId, ...(ignoreId ? { NOT: { id: ignoreId } } : {}) },
      select: { id: true },
    });
    if (!taken) return slug;
    slug = `${base}-${i + 1}`;
  }
  return `${base}-${Date.now()}`;
}

export async function purgarEvento(
  id: string,
  userId: string,
): Promise<"borrado" | "archivado" | null> {
  const ev = await db.event.findUnique({
    where: { id },
    select: {
      ownerId: true,
      coverUrl: true,
      rekCollectionId: true,
      _count: { select: { sales: true } },
    },
  });
  if (!ev || ev.ownerId !== userId) return null;

  // 1) Collect every S3 key tied to this event: originals + both previews + cover.
  const photos = await db.photo.findMany({
    where: { eventId: id },
    select: { storageKey: true, previewKey: true, previewCleanKey: true },
  });
  const s3Keys: string[] = [];
  for (const p of photos) {
    if (p.storageKey) s3Keys.push(p.storageKey);
    if (p.previewKey) s3Keys.push(p.previewKey);
    if (p.previewCleanKey) s3Keys.push(p.previewCleanKey);
  }
  if (ev.coverUrl) s3Keys.push(ev.coverUrl);

  // 2) Delete S3 objects in ≤1000-key batches (DeleteObjects hard cap).
  //    Best-effort: a failed batch is logged but doesn't abort the DB delete —
  //    leftover S3 objects can be swept later; a stuck DB row can't.
  for (let i = 0; i < s3Keys.length; i += 1000) {
    await deleteS3Objects(s3Keys.slice(i, i + 1000)).catch((err) => {
      console.error("[deleteEvent] S3 batch delete failed:", err);
    });
  }

  // 3) Drop the Rekognition collection (removes indexed faces upstream).
  if (ev.rekCollectionId) {
    await deleteRekCollection(ev.rekCollectionId).catch((err) => {
      console.error("[deleteEvent] Rekognition collection delete failed:", err);
    });
  }

  // 4) Hard-delete Photo rows. FaceRecord cascades; SaleItem.photoId → null.
  await db.photo.deleteMany({ where: { eventId: id } });

  if (ev._count.sales === 0) {
    // No sales anywhere — nuke the Event row too. Cascades to Discount.
    await db.event.delete({ where: { id } });
    return "borrado";
  } else {
    // Preserve Sale history: album becomes an empty ARCHIVED stub.
    await db.discount.deleteMany({ where: { eventId: id } });
    await db.event.update({
      where: { id },
      data: {
        status: "ARCHIVED",
        isPublished: false,
        coverUrl: null,
        rekCollectionId: null,
      },
    });
    return "archivado";
  }
}
