"use server";

import { revalidatePath, revalidateTag } from "next/cache";

import { auth } from "~/server/auth";
import { escribirBandera, HISTORIAS_ABIERTA, setMpTestMode } from "~/server/settings";

/** Historias para todas las cuentas activas, sin lista ni invitación. */
export async function toggleHistoriasAbiertaAction(enabled: boolean): Promise<void> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    throw new Error("No autorizado");
  }
  await escribirBandera(HISTORIAS_ABIERTA, enabled);
  revalidateTag(`setting:${HISTORIAS_ABIERTA}`);
  revalidatePath("/admin/settings");
}

export async function toggleMpTestModeAction(enabled: boolean): Promise<void> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    throw new Error("No autorizado");
  }
  await setMpTestMode(enabled);
  revalidateTag("setting:mp_test_mode");
  revalidatePath("/admin/settings");
}
