import { redirect } from "next/navigation";

import { auth } from "~/server/auth";
import { isCfConfigured } from "~/server/cloudflare";
import { db } from "~/server/db";
import { resolveMediaUrl } from "~/server/media";

import { TiendaClient } from "./tienda-client";

export default async function TiendaPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/dashboard/tienda");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      slug: true,
      storefrontBrandColor: true,
      storefrontTemplate: true,
      storefrontPublished: true,
      watermarkKey: true,
      logoKey: true,
    },
  });
  if (!user?.slug) redirect("/onboarding");

  const [watermarkUrl, logoUrl] = await Promise.all([
    user.watermarkKey
      ? resolveMediaUrl(user.watermarkKey)
      : null,
    user.logoKey
      ? resolveMediaUrl(user.logoKey)
      : null,
  ]);

  const totalPhotos = await db.photo.count({
    where: { ownerId: session.user.id, fileSize: { not: null }, deletedAt: null },
  });

  const domains = await db.customDomain.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      hostname: true,
      status: true,
      errorMessage: true,
      verifiedAt: true,
      createdAt: true,
    },
  });

  return (
    <TiendaClient
      slug={user.slug}
      brandColor={user.storefrontBrandColor ?? "#F5820A"}
      templateId={user.storefrontTemplate ?? "dark"}
      logoUrl={logoUrl}
      watermarkUrl={watermarkUrl}
      totalPhotos={totalPhotos}
      domains={domains.map((d) => ({
        ...d,
        verifiedAt: d.verifiedAt?.toISOString() ?? null,
        createdAt: d.createdAt.toISOString(),
      }))}
      cfEnabled={isCfConfigured()}
    />
  );
}
