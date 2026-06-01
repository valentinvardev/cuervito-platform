"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "~/server/auth";
import { db } from "~/server/db";

const colorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Color inválido.");
const VALID_TEMPLATES = ["dark", "light", "sport", "feed"] as const;

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
  revalidatePath("/dashboard/tienda");
  return { error: null };
}

export async function saveTemplateAction(
  templateId: string,
): Promise<{ error: string | null }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Sesión expirada." };
  if (!(VALID_TEMPLATES as readonly string[]).includes(templateId))
    return { error: "Template inválido." };

  await db.user.update({
    where: { id: session.user.id },
    data: { storefrontTemplate: templateId },
  });
  revalidatePath("/dashboard/tienda");
  return { error: null };
}
