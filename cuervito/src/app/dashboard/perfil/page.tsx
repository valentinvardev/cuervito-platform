import { db } from "~/server/db";

import { asegurarSlug, sesionPanel } from "../_components/sesion";
import { FormPerfil } from "./_form";

export const dynamic = "force-dynamic";

export default async function V2Perfil() {
  const { userId } = await sesionPanel();

  const u = await db.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      slug: true,
      bio: true,
      instagramUrl: true,
      websiteUrl: true,
      image: true,
    },
  });

  // Red para cuentas viejas sin dirección: se genera una antes de dibujar el
  // formulario. Sin esto, guardar el perfil fallaría por un campo que ya no
  // se muestra y el usuario no tendría forma de arreglarlo.
  const slug = await asegurarSlug(userId, u?.name ?? "fotografo", u?.slug ?? null);

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
            slug,
            bio: u?.bio ?? "",
            instagramUrl: u?.instagramUrl ?? "",
            websiteUrl: u?.websiteUrl ?? "",
          }}
          fotoInicial={u?.image ?? null}
        />
      </div>
    </main>
  );
}
