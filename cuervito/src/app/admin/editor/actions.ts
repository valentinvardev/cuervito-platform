"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "~/server/auth";
import { db } from "~/server/db";
import {
  emptyDoc,
  emptyFilters,
  parseMetadata,
  type EditorDoc,
  type ProjectMetadata,
} from "~/lib/editor-types";

async function adminGuard() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  if (session.user.role !== "ADMIN") throw new Error("Forbidden");
  return session.user.id;
}

export async function createProject(): Promise<void> {
  const userId = await adminGuard();
  const doc = emptyDoc();
  const project = await db.editorProject.create({
    data: {
      ownerId: userId,
      name: "Nuevo proyecto",
      sourceKey: null,
      layers: doc.layers as unknown as object,
      filters: emptyFilters() as unknown as object,
      width: doc.width,
      height: doc.height,
    },
    select: { id: true },
  });
  revalidatePath("/admin/editor");
  redirect(`/admin/editor/${project.id}`);
}

/**
 * Create a new project pre-populated from a template. Copies the template's
 * layers + filters + canvas dimensions; the new project starts without a
 * source photo so the user uploads one and the placeholders autofill.
 */
export async function createProjectFromTemplate(templateId: string): Promise<void> {
  const userId = await adminGuard();
  const tpl = await db.editorProject.findUnique({
    where: { id: templateId },
    select: {
      ownerId: true,
      isTemplate: true,
      name: true,
      layers: true,
      filters: true,
      width: true,
      height: true,
    },
  });
  if (!tpl || tpl.ownerId !== userId || !tpl.isTemplate) {
    throw new Error("Plantilla no encontrada");
  }
  const project = await db.editorProject.create({
    data: {
      ownerId: userId,
      name: `${tpl.name} — copia`,
      sourceKey: null,
      layers: (tpl.layers ?? []) as unknown as object,
      filters: (tpl.filters ?? emptyFilters()) as unknown as object,
      width: tpl.width,
      height: tpl.height,
      isTemplate: false,
    },
    select: { id: true },
  });
  revalidatePath("/admin/editor");
  redirect(`/admin/editor/${project.id}`);
}

/**
 * Snapshot the current project as a reusable template. Strips the source
 * photo + extracted metadata so the template carries only the design.
 */
export async function saveAsTemplate(
  projectId: string,
  name: string,
): Promise<{ error: string | null }> {
  const userId = await adminGuard();
  const trimmed = name.trim().slice(0, 120) || "Plantilla";
  const src = await db.editorProject.findUnique({
    where: { id: projectId },
    select: {
      ownerId: true,
      layers: true,
      filters: true,
      width: true,
      height: true,
    },
  });
  if (!src || src.ownerId !== userId) {
    return { error: "Proyecto no encontrado." };
  }
  await db.editorProject.create({
    data: {
      ownerId: userId,
      name: trimmed,
      sourceKey: null,
      layers: (src.layers ?? []) as unknown as object,
      filters: (src.filters ?? emptyFilters()) as unknown as object,
      width: src.width,
      height: src.height,
      isTemplate: true,
    },
  });
  revalidatePath("/admin/editor");
  return { error: null };
}

export async function renameProject(
  projectId: string,
  name: string,
): Promise<{ error: string | null }> {
  const userId = await adminGuard();
  const trimmed = name.trim().slice(0, 120);
  if (!trimmed) return { error: "El nombre no puede estar vacío." };
  const project = await db.editorProject.findUnique({
    where: { id: projectId },
    select: { ownerId: true },
  });
  if (!project || project.ownerId !== userId) return { error: "Proyecto no encontrado." };
  await db.editorProject.update({
    where: { id: projectId },
    data: { name: trimmed },
  });
  revalidatePath("/admin/editor");
  revalidatePath(`/admin/editor/${projectId}`);
  return { error: null };
}

export async function saveProjectDoc(
  projectId: string,
  doc: EditorDoc,
): Promise<{ error: string | null }> {
  const userId = await adminGuard();
  const project = await db.editorProject.findUnique({
    where: { id: projectId },
    select: { ownerId: true },
  });
  if (!project || project.ownerId !== userId) return { error: "Proyecto no encontrado." };
  // Strip transient fields (e.g. image-layer URLs) before persisting — the
  // URL gets re-resolved on every page load from the stored sourceKey.
  const cleanLayers = doc.layers.map((l) => {
    if (l.type === "image") {
      const { url: _url, ...rest } = l;
      return rest;
    }
    return l;
  });
  await db.editorProject.update({
    where: { id: projectId },
    data: {
      sourceKey: doc.sourceKey,
      layers: cleanLayers as unknown as object,
      filters: doc.filters as unknown as object,
      width: doc.width,
      height: doc.height,
    },
  });
  return { error: null };
}

export async function deleteProject(projectId: string): Promise<void> {
  const userId = await adminGuard();
  const project = await db.editorProject.findUnique({
    where: { id: projectId },
    select: { ownerId: true },
  });
  if (!project || project.ownerId !== userId) return;
  await db.editorProject.delete({ where: { id: projectId } });
  revalidatePath("/admin/editor");
  redirect("/admin/editor");
}

/**
 * Save the project's metadata. Used by the manual-edit form so the
 * photographer can fill in city/date/etc. on photos that lost their EXIF
 * (e.g. anything that went through WhatsApp). Whatever the user types here
 * fully replaces what's stored on the row.
 */
export async function updateProjectMetadata(
  projectId: string,
  metadata: ProjectMetadata,
): Promise<{ error: string | null }> {
  const userId = await adminGuard();
  const project = await db.editorProject.findUnique({
    where: { id: projectId },
    select: { ownerId: true },
  });
  if (!project || project.ownerId !== userId) return { error: "Proyecto no encontrado." };
  // Run the value through parseMetadata to defend against the client sending
  // garbage shapes, even though it's our own typed UI calling this.
  const clean = parseMetadata(metadata);
  await db.editorProject.update({
    where: { id: projectId },
    data: { metadata: clean as unknown as object },
  });
  return { error: null };
}

// ─── Folders ────────────────────────────────────────────────────────────────
export async function createFolder(
  name: string,
  eventId?: string | null,
): Promise<{ error: string | null; folderId: string | null }> {
  const userId = await adminGuard();
  const trimmed = name.trim().slice(0, 120);
  if (!trimmed) return { error: "El nombre no puede estar vacío.", folderId: null };

  // Verify the event belongs to the user if provided.
  if (eventId) {
    const ev = await db.event.findUnique({
      where: { id: eventId },
      select: { ownerId: true },
    });
    if (!ev || ev.ownerId !== userId) {
      return { error: "Evento no encontrado.", folderId: null };
    }
  }

  const folder = await db.editorFolder.create({
    data: {
      ownerId: userId,
      name: trimmed,
      eventId: eventId ?? null,
    },
    select: { id: true },
  });
  revalidatePath("/admin/editor");
  return { error: null, folderId: folder.id };
}

export async function renameFolder(
  folderId: string,
  name: string,
): Promise<{ error: string | null }> {
  const userId = await adminGuard();
  const trimmed = name.trim().slice(0, 120);
  if (!trimmed) return { error: "El nombre no puede estar vacío." };
  const folder = await db.editorFolder.findUnique({
    where: { id: folderId },
    select: { ownerId: true },
  });
  if (!folder || folder.ownerId !== userId) return { error: "Carpeta no encontrada." };
  await db.editorFolder.update({
    where: { id: folderId },
    data: { name: trimmed },
  });
  revalidatePath("/admin/editor");
  return { error: null };
}

export async function setFolderEvent(
  folderId: string,
  eventId: string | null,
): Promise<{ error: string | null }> {
  const userId = await adminGuard();
  const folder = await db.editorFolder.findUnique({
    where: { id: folderId },
    select: { ownerId: true },
  });
  if (!folder || folder.ownerId !== userId) return { error: "Carpeta no encontrada." };
  if (eventId) {
    const ev = await db.event.findUnique({
      where: { id: eventId },
      select: { ownerId: true },
    });
    if (!ev || ev.ownerId !== userId) return { error: "Evento no encontrado." };
  }
  await db.editorFolder.update({
    where: { id: folderId },
    data: { eventId },
  });
  revalidatePath("/admin/editor");
  return { error: null };
}

export async function deleteFolder(folderId: string): Promise<void> {
  const userId = await adminGuard();
  const folder = await db.editorFolder.findUnique({
    where: { id: folderId },
    select: { ownerId: true },
  });
  if (!folder || folder.ownerId !== userId) return;
  // Projects keep existing — folderId becomes null via onDelete: SetNull.
  await db.editorFolder.delete({ where: { id: folderId } });
  revalidatePath("/admin/editor");
}

/** Move a project into a folder (or unfile it with folderId = null). */
export async function moveProjectToFolder(
  projectId: string,
  folderId: string | null,
): Promise<{ error: string | null }> {
  const userId = await adminGuard();
  const project = await db.editorProject.findUnique({
    where: { id: projectId },
    select: { ownerId: true },
  });
  if (!project || project.ownerId !== userId) return { error: "Proyecto no encontrado." };
  if (folderId) {
    const folder = await db.editorFolder.findUnique({
      where: { id: folderId },
      select: { ownerId: true },
    });
    if (!folder || folder.ownerId !== userId) return { error: "Carpeta no encontrada." };
  }
  await db.editorProject.update({
    where: { id: projectId },
    data: { folderId },
  });
  revalidatePath("/admin/editor");
  return { error: null };
}
