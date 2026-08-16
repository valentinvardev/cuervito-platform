import { db } from "~/server/db";

import { sesionV2 } from "../_components/sesion";
import { FormPerfil } from "./_form";

export const dynamic = "force-dynamic";

export default async function V2Perfil() {
  const { userId } = await sesionV2();

  const u = await db.user.findUnique({
    where: { id: userId },
    select: { name: true, slug: true, bio: true, instagramUrl: true, websiteUrl: true },
  });

  return (
    <main className="canvas">
      <div className="canvas-in">
        <div className="head">
          <div>
            <h1>Perfil</h1>
            <p>Lo que el atleta ve de vos, y los datos de tu cuenta.</p>
          </div>
        </div>

        <FormPerfil
          inicial={{
            name: u?.name ?? "",
            slug: u?.slug ?? "",
            bio: u?.bio ?? "",
            instagramUrl: u?.instagramUrl ?? "",
            websiteUrl: u?.websiteUrl ?? "",
          }}
        />
      </div>
    </main>
  );
}
