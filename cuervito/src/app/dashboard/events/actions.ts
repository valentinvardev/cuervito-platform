"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "~/server/auth";
import { db } from "~/server/db";

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
  revalidatePath("/dashboard/events");
  redirect("/dashboard/events");
}

export async function deleteEventAction(id: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const ev = await db.event.findUnique({ where: { id }, select: { ownerId: true } });
  if (!ev || ev.ownerId !== session.user.id) redirect("/dashboard/events");

  await db.event.delete({ where: { id } });
  revalidatePath("/dashboard/events");
  revalidatePath("/dashboard");
  redirect("/dashboard/events");
}
