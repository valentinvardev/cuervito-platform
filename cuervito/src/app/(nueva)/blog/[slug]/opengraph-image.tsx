import fs from "node:fs/promises";
import path from "node:path";

import { ImageResponse } from "next/og";

import { CATEGORIAS, categoriasConPosts, esCategoria, listarPosts, traerPost } from "~/server/blog";

/**
 * La imagen que aparece al compartir un post: por WhatsApp, que es por donde
 * se mueve todo esto, un link sin imagen es una línea de texto que nadie abre.
 *
 * Mismos colores que la landing en papel. La tipografía es la que trae
 * next/og: la de la marca habría que bajarla en cada build, y un build que
 * depende de la red de Google para terminar es un build que algún día no
 * termina.
 */

export const alt = "encontrate.app · Blog";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export async function generateStaticParams() {
  const [posts, secciones] = await Promise.all([listarPosts(), categoriasConPosts()]);
  return [...secciones.map((slug) => ({ slug })), ...posts.map((p) => ({ slug: p.slug }))];
}

const PAPEL = "#FAFAF8";
const TINTA = "#12110F";
const TINTA_2 = "#55524C";
const ACENTO = "#F0410F";

export default async function Imagen({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  let etiqueta = "Blog";
  let titulo = "Fotos de eventos deportivos";
  if (esCategoria(slug)) {
    etiqueta = "Blog";
    titulo = CATEGORIAS[slug].titulo;
  } else {
    const p = await traerPost(slug);
    if (p) {
      etiqueta = CATEGORIAS[p.categoria].nombre;
      titulo = p.titulo;
    }
  }

  const logo = await fs.readFile(path.join(process.cwd(), "public", "marca", "logo-tinta.png"));
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: PAPEL,
          padding: "72px 80px",
          borderTop: `14px solid ${ACENTO}`,
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 26,
            fontWeight: 600,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: TINTA_2,
          }}
        >
          {etiqueta}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: titulo.length > 48 ? 64 : 76,
            fontWeight: 800,
            lineHeight: 1.08,
            letterSpacing: "-0.03em",
            color: TINTA,
          }}
        >
          {titulo}
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoSrc} alt="" width={366} height={80} />
      </div>
    ),
    size,
  );
}
