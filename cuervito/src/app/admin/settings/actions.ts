"use server";

import { revalidatePath, revalidateTag } from "next/cache";

import { auth } from "~/server/auth";
import { setMpTestMode } from "~/server/settings";

export async function toggleMpTestModeAction(enabled: boolean): Promise<void> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    throw new Error("No autorizado");
  }
  await setMpTestMode(enabled);
  revalidateTag("setting:mp_test_mode");
  revalidatePath("/admin/settings");
}
