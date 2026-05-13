"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "~/server/auth";
import { db } from "~/server/db";

export type PerfilState = {
  error: string | null;
  saved?: boolean;
  fieldErrors?: Record<string, string>;
};

const perfilSchema = z.object({
  name: z.string().trim().min(2, "Ingresá tu nombre completo.").max(80),
  slug: z
    .string()
    .trim()
    .min(3, "El usuario tiene que tener al menos 3 caracteres.")
    .max(40)
    .regex(/^[a-z0-9-]+$/, "Solo minúsculas, números y guiones."),
  bio: z.string().trim().min(20, "Contanos un poco más (mín 20 caracteres).").max(280),
  instagramUrl: z.string().trim().max(80).optional(),
  websiteUrl: z.string().trim().url("URL inválida.").or(z.literal("")).optional(),
});

export async function savePerfilAction(
  _prev: PerfilState,
  formData: FormData,
): Promise<PerfilState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Sesión expirada." };

  const parsed = perfilSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    bio: formData.get("bio"),
    instagramUrl: formData.get("instagramUrl") ?? undefined,
    websiteUrl: formData.get("websiteUrl") ?? undefined,
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path[0];
      if (typeof path === "string" && !fieldErrors[path]) {
        fieldErrors[path] = issue.message;
      }
    }
    return { error: "Revisá los campos marcados.", fieldErrors };
  }

  const { name, slug, bio, instagramUrl, websiteUrl } = parsed.data;

  // Slug uniqueness — skip if it's our own current slug
  const taken = await db.user.findFirst({
    where: { slug, NOT: { id: session.user.id } },
    select: { id: true },
  });
  if (taken) {
    return {
      error: "Ese usuario ya está en uso.",
      fieldErrors: { slug: "Ya hay alguien con ese usuario. Probá otro." },
    };
  }

  await db.user.update({
    where: { id: session.user.id },
    data: {
      name,
      slug,
      bio,
      instagramUrl: instagramUrl || null,
      websiteUrl: websiteUrl || null,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/perfil");
  return { error: null, saved: true };
}
