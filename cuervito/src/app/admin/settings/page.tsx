import { redirect } from "next/navigation";

import { auth } from "~/server/auth";
import { getMpTestMode } from "~/server/settings";

import { SettingsClient } from "./settings-client";

export default async function AdminSettingsPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const mpTestMode = await getMpTestMode();

  return <SettingsClient mpTestMode={mpTestMode} />;
}
