"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { emptyDoc, emptyFilters, type EditorDoc } from "~/lib/editor-types";

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
