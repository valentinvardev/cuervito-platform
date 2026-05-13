import { redirect } from "next/navigation";

import { auth } from "~/server/auth";
import { db } from "~/server/db";

import { WelcomeScreen } from "./welcome-screen";

export default async function OnboardingWelcomePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { onboardingCompletedAt: true, mpConnectedAt: true, mpOnboardingSkipped: true },
  });
  if (!user?.onboardingCompletedAt) redirect("/onboarding");
  if (!user.mpConnectedAt && !user.mpOnboardingSkipped) redirect("/onboarding/mp");

  return <WelcomeScreen />;
}
