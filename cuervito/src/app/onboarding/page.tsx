import { redirect } from "next/navigation";

import { auth } from "~/server/auth";
import { db } from "~/server/db";

import { ProfileShell } from "./profile-shell";

export default async function OnboardingProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/onboarding");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      slug: true,
      bio: true,
      instagramUrl: true,
      websiteUrl: true,
      onboardingCompletedAt: true,
      mpConnectedAt: true,
      mpOnboardingSkipped: true,
    },
  });
  if (!user) redirect("/login");

  // If both steps done → dashboard
  if (user.onboardingCompletedAt && (user.mpConnectedAt || user.mpOnboardingSkipped)) {
    redirect("/dashboard");
  }
  // Profile done, MP pending → step 2
  if (user.onboardingCompletedAt) {
    redirect("/onboarding/mp");
  }

  return (
    <ProfileShell
      initial={{
        name: user.name ?? "",
        slug: user.slug ?? "",
        bio: user.bio ?? "",
        instagramUrl: user.instagramUrl ?? "",
        websiteUrl: user.websiteUrl ?? "",
      }}
    />
  );
}
