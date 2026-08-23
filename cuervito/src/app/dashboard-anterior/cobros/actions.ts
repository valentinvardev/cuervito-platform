"use server";

import { revalidatePath } from "next/cache";

import { auth } from "~/server/auth";
import { db } from "~/server/db";

/**
 * Activa/desactiva el modo de prueba del vendedor. Solo disponible para
 * usuarios con role=ADMIN: deja que un admin pruebe el flujo de compra
 * end to end en sus propios eventos sin cobrar de verdad.
 *
 * El checkout revalida el rol por su cuenta antes de aplicar el bypass,
 * así que este guard es la primera de dos barreras, no la única.
 */
export async function setSellerTestModeAction(
  enabled: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sesión expirada." };

  // Leemos el rol de la DB en vez de confiar en el JWT: el token puede
  // ser viejo y traer un rol que ya no corresponde.
  const me = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (me?.role !== "ADMIN") {
    return { ok: false, error: "Solo administradores pueden usar el modo de prueba." };
  }

  await db.user.update({
    where: { id: session.user.id },
    data: { testModeEnabled: enabled },
  });

  // Dejamos rastro en la auditoría: es un bypass de cobro.
  await db.adminAction
    .create({
      data: {
        actorId: session.user.id,
        action: enabled ? "TEST_MODE_ON" : "TEST_MODE_OFF",
        targetType: "User",
        targetId: session.user.id,
      },
    })
    .catch((err) => console.error("[test-mode] audit log failed:", err));

  revalidatePath("/dashboard-anterior/cobros");
  return { ok: true };
}
