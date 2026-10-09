import { clasesFuentes } from "~/app/_portfolio/fuentes";
import { db } from "~/server/db";
import { cifrasDe, disenoDe, eventosDe, fotosDePortfolio } from "~/server/portfolio";

import { portfolioPropio, sesionPortfolio } from "../../_acceso";
import { Editor } from "./_editor";

export const dynamic = "force-dynamic";

export const metadata = { title: "Editor de portfolio" };

/**
 * El editor visual: el sitio de verdad, en el medio, con los textos, colores
 * y secciones a los costados. Pantalla completa, sobre el panel.
 */
export default async function EditorPortfolio({ params }: { params: Promise<{ id: string }> }) {
  const { userId, yo, slug } = await sesionPortfolio();
  const { id } = await params;
  const p = await portfolioPropio(userId, id);
  // La vista del dueño: también las fotos cuya versión todavía se prepara.
  const [fotos, perfil, cifras, eventos] = await Promise.all([
    fotosDePortfolio(id, true),
    db.user.findUnique({ where: { id: userId }, select: { location: true } }),
    cifrasDe(userId),
    eventosDe(userId, slug, null),
  ]);

  return (
    <div className={clasesFuentes}>
      <Editor
        portfolioId={id}
        nombre={p.nombre}
        url={`/${slug}/p/${p.slug}`}
        publicado={Boolean(p.publicadoAt)}
        diseno={disenoDe(p)}
        fotos={fotos}
        perfil={{
          nombre: yo?.name ?? "Tu nombre",
          ubicacion: perfil?.location ?? null,
          instagram: yo?.instagramUrl ?? null,
          web: yo?.websiteUrl ?? null,
          cifras,
          eventos,
        }}
      />
    </div>
  );
}
