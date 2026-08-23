import { ExternalLink } from "lucide-react";

import { db } from "~/server/db";

import { sesionPanel } from "../_components/sesion";
import { Editor } from "./_editor";

export const dynamic = "force-dynamic";

export default async function V2Pagina() {
  const { userId, slug } = await sesionPanel();

  const u = await db.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      slug: true,
      bio: true,
      instagramUrl: true,
      websiteUrl: true,
      storefrontBrandColor: true,
      storefrontTemplate: true,
    },
  });

  return (
    <main className="canvas">
      <div className="canvas-in">
        <div className="head">
          <div>
            <h1>Mi página</h1>
            <p>Tu página pública, con tu marca adelante y la nuestra atrás.</p>
          </div>
          <div className="head-r">
            {/* En pestaña nueva: el ícono lo dice antes de apretar, así nadie
                pierde lo que estaba configurando por irse sin querer. */}
            <a href={`/${slug}`} target="_blank" rel="noopener" className="btn btn-ghost">
              <ExternalLink /> Abrir
            </a>
          </div>
        </div>

        <Editor
          perfil={{
            name: u?.name ?? "",
            slug: u?.slug ?? "",
            bio: u?.bio ?? "",
            instagramUrl: u?.instagramUrl ?? "",
            websiteUrl: u?.websiteUrl ?? "",
          }}
          colorInicial={u?.storefrontBrandColor ?? "#F0410F"}
          plantillaInicial={u?.storefrontTemplate ?? "light"}
        />
      </div>
    </main>
  );
}
