import { type Metadata } from "next";

import { JsonLd } from "~/app/_components/json-ld";
import { NOMBRE, SITIO } from "~/lib/marca";
import { categoriasConPosts, listarPosts } from "~/server/blog";

import { Listado, Secciones } from "./_listado";

const TITULO = "Blog de encontrate: fotos de eventos deportivos";
const DESCRIPCION =
  "Guías para fotógrafos que venden fotos de carreras y partidos, y para atletas que buscan las suyas: precios, cobro con Mercado Pago, búsqueda por dorsal y selfie.";

export const metadata: Metadata = {
  title: TITULO,
  description: DESCRIPCION,
  alternates: { canonical: "/blog" },
  openGraph: { type: "website", title: TITULO, description: DESCRIPCION, url: "/blog" },
};

export default async function BlogPage() {
  const [posts, hay] = await Promise.all([listarPosts(), categoriasConPosts()]);

  return (
    <>
      <header className="hero blog-hero">
        <div className="wrap">
          <span className="label eyebrow">Blog</span>
          <h1>
            Fotos de eventos,
            <br />
            <em>contadas de adentro.</em>
          </h1>
          <p className="lede">
            Lo que aprendimos vendiendo fotos de carreras y partidos: cuánto cobrar, cómo llegar a
            los atletas, cómo se cobra. Y para el que corrió, cómo encontrar sus fotos.
          </p>
        </div>
      </header>

      <section className="blog-cuerpo">
        <div className="wrap">
          <Secciones activa={null} hay={hay} />
          <Listado posts={posts} />
        </div>
      </section>

      <JsonLd
        datos={{
          "@context": "https://schema.org",
          "@type": "Blog",
          name: TITULO,
          description: DESCRIPCION,
          url: `${SITIO}/blog`,
          inLanguage: "es-AR",
          publisher: { "@type": "Organization", name: NOMBRE, url: SITIO },
          blogPost: posts.map((p) => ({
            "@type": "BlogPosting",
            headline: p.titulo,
            url: `${SITIO}/blog/${p.slug}`,
            datePublished: p.publicado.toISOString(),
          })),
        }}
      />
    </>
  );
}
