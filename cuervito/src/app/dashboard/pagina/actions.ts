"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";

import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { COOKIE_PREVIA, PREVIA_MAX_AGE, esPlantilla } from "~/server/plantilla-previa";

const colorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Color inválido.");

/**
 * Prende o apaga la previa de una plantilla en la tienda propia (ver
 * server/plantilla-previa.ts). Con null la apaga. No guarda nada: es lo que
 * el modal muestra mientras se elige.
 */
export async function previsualizarPlantillaAction(templateId: string | null): Promise<{ error: string | null }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Sesión expirada." };
  const jar = await cookies();
  if (templateId === null) {
    jar.delete(COOKIE_PREVIA);
    return { error: null };
  }
  if (!esPlantilla(templateId)) return { error: "Plantilla inválida." };
  jar.set(COOKIE_PREVIA, templateId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: PREVIA_MAX_AGE,
  });
  return { error: null };
}

export async function saveBrandColorAction(
  color: string,
): Promise<{ error: string | null }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Sesión expirada." };
  const parsed = colorSchema.safeParse(color);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Color inválido." };

  await db.user.update({
    where: { id: session.user.id },
    data: { storefrontBrandColor: parsed.data.toUpperCase() },
  });
  revalidatePath("/dashboard/pagina");
  return { error: null };
}

export async function saveTemplateAction(
  templateId: string,
): Promise<{ error: string | null }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Sesión expirada." };
  if (!esPlantilla(templateId)) return { error: "Plantilla inválida." };

  await db.user.update({
    where: { id: session.user.id },
    data: { storefrontTemplate: templateId },
  });
  // Elegida de verdad: la previa ya no hace falta, y si quedara, la página
  // propia seguiría mostrando la que se estaba probando.
  (await cookies()).delete(COOKIE_PREVIA);
  revalidatePath("/dashboard/pagina");
  return { error: null };
}
