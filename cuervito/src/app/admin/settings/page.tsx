import { redirect } from "next/navigation";

import { auth } from "~/server/auth";
import { getMpTestMode, HISTORIAS_ABIERTA, leerBandera } from "~/server/settings";

import { SettingsClient } from "./settings-client";

export default async function AdminSettingsPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const [mpTestMode, historiasAbierta] = await Promise.all([
    getMpTestMode(),
    leerBandera(HISTORIAS_ABIERTA),
  ]);

  return <SettingsClient mpTestMode={mpTestMode} historiasAbierta={historiasAbierta} />;
}
