"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { esPlantilla } from "~/lib/storefront-templates";
import { auth } from "~/server/auth";
import { db } from "~/server/db";

const colorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Color inválido.");

/**
 * El color de marca. `cual` dice si es el principal o el secundario: el
 * secundario sólo lo dibujan las plantillas de dos colores (Cancha), pero se
 * guarda con cualquiera, para que al pasar a una de dos ya esté.
 */
export async function saveBrandColorAction(
  color: string,
  cual: 1 | 2 = 1,
): Promise<{ error: string | null }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Sesión expirada." };
  const parsed = colorSchema.safeParse(color);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Color inválido." };

  const valor = parsed.data.toUpperCase();
  await db.user.update({
    where: { id: session.user.id },
    data: cual === 2 ? { storefrontBrandColor2: valor } : { storefrontBrandColor: valor },
  });
  revalidatePath("/dashboard/pagina");
  return { error: null };
}

/**
 * La plantilla, y con ella los colores con los que se la miró en el diálogo.
 *
 * Van juntos a propósito: el fotógrafo eligió la plantilla VIENDO esos
 * colores, y guardar una cosa sin la otra le cambia la página a algo que no
 * vio. Si no manda colores, quedan los que tenía.
 */
export async function saveTemplateAction(
  templateId: string,
  colores?: { color?: string | null; color2?: string | null },
): Promise<{ error: string | null }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Sesión expirada." };
  // Contra el catálogo y no contra una lista propia: dos listas del mismo
  // dato terminan distintas, y la que queda vieja rechaza plantillas reales.
  if (!esPlantilla(templateId)) return { error: "Plantilla inválida." };

  const data: {
    storefrontTemplate: string;
    storefrontBrandColor?: string;
    storefrontBrandColor2?: string | null;
  } = { storefrontTemplate: templateId };

  if (colores?.color) {
    const c = colorSchema.safeParse(colores.color);
    if (!c.success) return { error: "Color inválido." };
    data.storefrontBrandColor = c.data.toUpperCase();
  }
  // En una plantilla de un solo color el secundario no se dibuja; igual se
  // conserva, por si vuelve a una de dos.
  if (colores?.color2 !== undefined) {
    if (colores.color2 === null) {
      data.storefrontBrandColor2 = null;
    } else {
      const c = colorSchema.safeParse(colores.color2);
      if (!c.success) return { error: "Color secundario inválido." };
      data.storefrontBrandColor2 = c.data.toUpperCase();
    }
  }

  await db.user.update({ where: { id: session.user.id }, data });
  revalidatePath("/dashboard/pagina");
  return { error: null };
}
