import { redirect } from "next/navigation";

import { auth } from "~/server/auth";
import { db } from "~/server/db";

import { TiendaClient } from "./tienda-client";

export default async function TiendaPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/dashboard/tienda");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      slug: true,
      storefrontBrandColor: true,
      storefrontPublished: true,
    },
  });
  if (!user?.slug) redirect("/onboarding");

  return (
    <TiendaClient
      slug={user.slug}
      brandColor={user.storefrontBrandColor ?? "#F5820A"}
    />
  );
}
