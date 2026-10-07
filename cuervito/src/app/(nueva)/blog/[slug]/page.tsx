import { type Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { compileMDX } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";

import { JsonLd } from "~/app/_components/json-ld";
import { NOMBRE, SITIO } from "~/lib/marca";
import {
  CATEGORIAS,
  type Categoria,
  categoriasConPosts,
  esCategoria,
  fechaLarga,
  listarPosts,
  type Post,
  traerPost,
} from "~/server/blog";

import { Listado, Secciones } from "../_listado";
import { componentesMdx, Llamado } from "../_mdx";

/* /blog/{algo} es una sección o un post. Las dos listas se conocen en el
   build y no hay otra cosa que pueda vivir acá: cualquier otra dirección es
   un 404 sin pasar por el servidor. */
export const dynamicParams = false;

export async function generateStaticParams() {
  const [posts, secciones] = await Promise.all([listarPosts(), categoriasConPosts()]);
  return [...secciones.map((slug) => ({ slug })), ...posts.map((p) => ({ slug: p.slug }))];
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;

  if (esCategoria(slug)) {
    const c = CATEGORIAS[slug];
    return {
      title: c.titulo,
      description: c.descripcion,
      alternates: { canonical: `/blog/${slug}` },
      openGraph: { type: "website", title: c.titulo, description: c.descripcion, url: `/blog/${slug}` },
    };
  }

  const p = await traerPost(slug);
  if (!p) return {};
  return {
    title: p.titulo,
    description: p.descripcion,
    alternates: { canonical: `/blog/${p.slug}` },
    // Un borrador sólo existe en desarrollo, pero si alguna vez se cuela, que
    // no lo indexe nadie.
    ...(p.borrador ? { robots: { index: false, follow: false } } : {}),
    openGraph: {
      type: "article",
      title: p.titulo,
      description: p.descripcion,
      url: `/blog/${p.slug}`,
      publishedTime: p.publicado.toISOString(),
      ...(p.actualizado ? { modifiedTime: p.actualizado.toISOString() } : {}),
      section: CATEGORIAS[p.categoria].nombre,
    },
    twitter: { card: "summary_large_image", title: p.titulo, description: p.descripcion },
  };
}

export default async function BlogSlugPage({ params }: Props) {
  const { slug } = await params;
  if (esCategoria(slug)) return <Seccion categoria={slug} />;

  const post = await traerPost(slug);
  if (!post) notFound();
  return <Articulo post={post} />;
}

async function Seccion({ categoria }: { categoria: Categoria }) {
  const c = CATEGORIAS[categoria];
  const [todos, hay] = await Promise.all([listarPosts(), categoriasConPosts()]);
  const posts = todos.filter((p) => p.categoria === categoria);
  // En producción no llega: generateStaticParams no la incluye. En desarrollo
  // sí, y una sección vacía tiene que verse como lo que va a ser, un 404.
  if (!hay.includes(categoria)) notFound();

  return (
    <>
      <header className="hero blog-hero">
        <div className="wrap">
          <span className="label eyebrow">
            <Link href="/blog">Blog</Link> / {c.nombre}
          </span>
          <h1>{c.titulo}</h1>
          <p className="lede">{c.descripcion}</p>
        </div>
      </header>

      <section className="blog-cuerpo">
        <div className="wrap">
          <Secciones activa={categoria} hay={hay} />
          <Listado posts={posts} />
        </div>
      </section>

      <JsonLd
        datos={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: c.titulo,
          description: c.descripcion,
          url: `${SITIO}/blog/${categoria}`,
          inLanguage: "es-AR",
          hasPart: posts.map((p) => ({
            "@type": "BlogPosting",
            headline: p.titulo,
            url: `${SITIO}/blog/${p.slug}`,
          })),
        }}
      />
    </>
  );
}

async function Articulo({ post }: { post: Post }) {
  const seccion = CATEGORIAS[post.categoria];
  const [{ content }, todos] = await Promise.all([
    compileMDX({
      source: post.cuerpo,
      components: componentesMdx,
      options: { mdxOptions: { remarkPlugins: [remarkGfm] } },
    }),
    listarPosts(),
  ]);

  // Primero los de la misma sección; si no alcanzan, los más nuevos.
  const otros = todos.filter((p) => p.slug !== post.slug);
  const relacionados = [
    ...otros.filter((p) => p.categoria === post.categoria),
    ...otros.filter((p) => p.categoria !== post.categoria),
  ].slice(0, 3);

  const url = `${SITIO}/blog/${post.slug}`;

  return (
    <>
      <article className="blog-post">
        <header className="wrap blog-post-cab">
          <nav className="label eyebrow" aria-label="Ruta">
            <Link href="/blog">Blog</Link> / <Link href={`/blog/${post.categoria}`}>{seccion.nombre}</Link>
          </nav>
          <h1>{post.titulo}</h1>
          <p className="lede">{post.descripcion}</p>
          <p className="blog-meta">
            <time dateTime={post.publicado.toISOString().slice(0, 10)}>{fechaLarga(post.publicado)}</time>
            {post.actualizado && (
              <>
                {" · actualizado el "}
                <time dateTime={post.actualizado.toISOString().slice(0, 10)}>
                  {fechaLarga(post.actualizado)}
                </time>
              </>
            )}
            {" · "}
            {post.minutos} min de lectura
          </p>
        </header>

        <div className="wrap">
          <div className="prosa">{content}</div>
          <div className="prosa-ancho">
            <Llamado para={post.categoria === "fotografos" ? "fotografos" : "atletas"} />
          </div>
        </div>
      </article>

      {relacionados.length > 0 && (
        <section className="blog-cuerpo blog-relacionados">
          <div className="wrap">
            <span className="label eyebrow">Seguí leyendo</span>
            <Listado posts={relacionados} />
          </div>
        </section>
      )}

      <JsonLd
        datos={[
          {
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            headline: post.titulo,
            description: post.descripcion,
            url,
            mainEntityOfPage: url,
            datePublished: post.publicado.toISOString(),
            dateModified: (post.actualizado ?? post.publicado).toISOString(),
            inLanguage: "es-AR",
            articleSection: seccion.nombre,
            author: { "@type": "Organization", name: NOMBRE, url: SITIO },
            publisher: {
              "@type": "Organization",
              name: NOMBRE,
              url: SITIO,
              logo: { "@type": "ImageObject", url: `${SITIO}/android-chrome-512x512.png` },
            },
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Blog", item: `${SITIO}/blog` },
              {
                "@type": "ListItem",
                position: 2,
                name: seccion.nombre,
                item: `${SITIO}/blog/${post.categoria}`,
              },
              { "@type": "ListItem", position: 3, name: post.titulo, item: url },
            ],
          },
        ]}
      />
    </>
  );
}
