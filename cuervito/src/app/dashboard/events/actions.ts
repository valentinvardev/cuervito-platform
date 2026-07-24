"use server";

import { revalidatePath, revalidateTag } from "next/cache";

function busUserDashboardCache(userId: string) {
  revalidateTag(`user:${userId}:dashboard`);
  revalidateTag(`user:${userId}:events`);
  revalidateTag(`user:${userId}:quota`);
}
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { deleteRekCollection } from "~/server/rekognition";
import { deleteS3Objects } from "~/server/s3";

function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function uniqueSlug(base: string, userId: string, ignoreId?: string): Promise<string> {
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

export type EventFormState = { error: string | null; fieldErrors?: Record<string, string> };

const eventSchema = z.object({
  name: z.string().trim().min(3, "Mín 3 caracteres.").max(120),
  discipline: z.string().trim().max(40).optional(),
  location: z.string().trim().max(80).optional(),
  eventDate: z.string().optional(),
  pricePerPhoto: z.coerce.number().min(0).max(10_000_000).default(2400),
  description: z.string().trim().max(2000).optional(),
});

export async function createEventAction(
  _prev: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Sesión expirada." };
  }

  const parsed = eventSchema.safeParse({
    name: formData.get("name"),
    discipline: formData.get("discipline") || undefined,
    location: formData.get("location") || undefined,
    eventDate: formData.get("eventDate") || undefined,
    pricePerPhoto: formData.get("pricePerPhoto") || 2400,
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path[0];
      if (typeof path === "string" && !fieldErrors[path]) fieldErrors[path] = issue.message;
    }
    return { error: "Revisá los campos marcados.", fieldErrors };
  }

  const { name, discipline, location, eventDate, pricePerPhoto, description } = parsed.data;

  const base = slugify(name);
  const slug = await uniqueSlug(base, session.user.id);

  const event = await db.event.create({
    data: {
      ownerId: session.user.id,
      slug,
      name,
      discipline: discipline ?? null,
      location: location ?? null,
      eventDate: eventDate ? new Date(eventDate) : null,
      pricePerPhoto,
      description: description ?? null,
      status: "DRAFT",
    },
    select: { id: true },
  });

  busUserDashboardCache(session.user.id);
  revalidatePath("/dashboard/events");
  revalidatePath("/dashboard");
  redirect(`/dashboard/events/${event.id}`);
}

export async function updateEventAction(
  id: string,
  _prev: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Sesión expirada." };

  const event = await db.event.findUnique({
    where: { id },
    select: { ownerId: true, slug: true, name: true },
  });
  if (!event || event.ownerId !== session.user.id) {
    return { error: "Evento no encontrado." };
  }

  const parsed = eventSchema.safeParse({
    name: formData.get("name"),
    discipline: formData.get("discipline") || undefined,
    location: formData.get("location") || undefined,
    eventDate: formData.get("eventDate") || undefined,
    pricePerPhoto: formData.get("pricePerPhoto") || 2400,
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path[0];
      if (typeof path === "string" && !fieldErrors[path]) fieldErrors[path] = issue.message;
    }
    return { error: "Revisá los campos marcados.", fieldErrors };
  }

  const { name, discipline, location, eventDate, pricePerPhoto, description } = parsed.data;
  // Regenerate slug if the name changed
  let slug = event.slug;
  if (name !== event.name) {
    slug = await uniqueSlug(slugify(name), session.user.id, id);
  }

  await db.event.update({
    where: { id },
    data: {
      name,
      slug,
      discipline: discipline ?? null,
      location: location ?? null,
      eventDate: eventDate ? new Date(eventDate) : null,
      pricePerPhoto,
      description: description ?? null,
    },
  });

  busUserDashboardCache(session.user.id);
  revalidatePath("/dashboard/events");
  revalidatePath(`/dashboard/events/${id}`);
  redirect(`/dashboard/events/${id}`);
}

export async function togglePublishedAction(id: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const ev = await db.event.findUnique({
    where: { id },
    select: { ownerId: true, isPublished: true, status: true },
  });
  if (!ev || ev.ownerId !== session.user.id) return;

  const newPublished = !ev.isPublished;
  await db.event.update({
    where: { id },
    data: {
      isPublished: newPublished,
      // When publishing, also flip DRAFT → ACTIVE so the public storefront
      // reflects the right status pill.
      ...(newPublished && ev.status === "DRAFT" ? { status: "ACTIVE" } : {}),
    },
  });

  busUserDashboardCache(session.user.id);
  revalidatePath(`/dashboard/events/${id}`);
  revalidatePath("/dashboard/events");
  revalidatePath("/dashboard");
}

export async function archiveEventAction(id: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const ev = await db.event.findUnique({ where: { id }, select: { ownerId: true } });
  if (!ev || ev.ownerId !== session.user.id) redirect("/dashboard/events");

  await db.event.update({ where: { id }, data: { status: "ARCHIVED", isPublished: false } });
  busUserDashboardCache(session.user.id);
  revalidatePath("/dashboard/events");
  redirect("/dashboard/events");
}

export async function deleteEventAction(id: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const ev = await db.event.findUnique({
    where: { id },
    select: {
      ownerId: true,
      coverUrl: true,
      rekCollectionId: true,
      _count: { select: { sales: true } },
    },
  });
  if (!ev || ev.ownerId !== session.user.id) redirect("/dashboard/events");

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
  }

  busUserDashboardCache(session.user.id);
  revalidatePath("/dashboard/events");
  revalidatePath("/dashboard");
  redirect("/dashboard/events");
}
