import { db } from "~/server/db";

import { sesionV2 } from "../_components/sesion";
import { Editor } from "./_editor";

export const dynamic = "force-dynamic";

export default async function V2Pagina() {
  const { userId, nombre, slug } = await sesionV2();

  const [ajustes, fotos] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: { storefrontBrandColor: true, storefrontTemplate: true },
    }),
    db.photo.count({ where: { ownerId: userId, deletedAt: null, fileSize: { not: null } } }),
  ]);

  return (
    <main className="canvas">
      <div className="canvas-in">
        <div className="head">
          <div>
            <h1>Mi página</h1>
            <p>Tu página pública, con tu marca adelante y la nuestra atrás.</p>
          </div>
          <div className="head-r">
            <a href={`/${slug}`} target="_blank" rel="noopener" className="btn btn-ghost">
              Abrir
            </a>
          </div>
        </div>

        <Editor
          slug={slug}
          nombre={nombre}
          colorInicial={ajustes?.storefrontBrandColor ?? "#F0410F"}
          plantillaInicial={ajustes?.storefrontTemplate ?? "light"}
          fotos={fotos}
        />
      </div>
    </main>
  );
}
