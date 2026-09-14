"use server";

import { revalidatePath } from "next/cache";

import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { CONFIG_POR_DEFECTO, esquemaConfig, guardarConfigMarca } from "~/server/marca-agua";

async function admin() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") throw new Error("No autorizado");
  return session.user;
}

/**
 * Guarda la configuración de la marca de agua.
 *
 * Vale desde la próxima foto que se procese. Lo ya procesado no cambia solo:
 * para eso está "Regenerar" en la misma pantalla, y es a propósito que sea
 * un paso aparte, porque son minutos de CPU y una invalidación de CloudFront.
 */
export async function guardarConfigMarcaAction(crudo: unknown): Promise<{ ok: boolean; error?: string }> {
  const yo = await admin();
  const p = esquemaConfig.safeParse(crudo);
  if (!p.success) return { ok: false, error: "La configuración no es válida." };
  await guardarConfigMarca(p.data);
  await db.adminAction.create({
    data: {
      actorId: yo.id,
      action: "UPDATE_WATERMARK_CONFIG",
      targetType: "Setting",
      targetId: "watermark:config",
      metadata: p.data,
    },
  });
  revalidatePath("/admin/watermark");
  return { ok: true };
}

export async function restablecerConfigMarcaAction(): Promise<{ ok: boolean }> {
  const yo = await admin();
  await guardarConfigMarca(CONFIG_POR_DEFECTO);
  await db.adminAction.create({
    data: {
      actorId: yo.id,
      action: "RESET_WATERMARK_CONFIG",
      targetType: "Setting",
      targetId: "watermark:config",
    },
  });
  revalidatePath("/admin/watermark");
  return { ok: true };
}
