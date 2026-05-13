import { redirect } from "next/navigation";

import { auth } from "~/server/auth";
import { resolveAvatarUrl } from "~/server/avatar";
import { db } from "~/server/db";

import { PerfilForm } from "./perfil-form";

export default async function PerfilPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/dashboard/perfil");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      email: true,
      slug: true,
      bio: true,
      instagramUrl: true,
      websiteUrl: true,
      image: true,
      mpConnectedAt: true,
    },
  });
  if (!user) redirect("/login");

  const avatarUrl = await resolveAvatarUrl(user.image);

  return (
    <main className="wrap-narrower">
      <div className="head">
        <h1>Mi perfil</h1>
        <div className="sub">Datos personales y página pública.</div>
      </div>

      <PerfilForm
        email={user.email ?? ""}
        mpConnected={!!user.mpConnectedAt}
        initial={{
          name: user.name ?? "",
          slug: user.slug ?? "",
          bio: user.bio ?? "",
          instagramUrl: user.instagramUrl ?? "",
          websiteUrl: user.websiteUrl ?? "",
          avatarUrl: avatarUrl ?? "",
        }}
      />
    </main>
  );
}
