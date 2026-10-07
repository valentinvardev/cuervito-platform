import { type MetadataRoute } from "next";

import { SITIO } from "~/lib/marca";
import { slugReservado } from "~/lib/slugs-reservados";
import { categoriasConPosts, listarPosts } from "~/server/blog";
import { db } from "~/server/db";

/* Se arma en cada pedido y no en el build: el build no tiene por qué depender
   de la base, y Google lo pide un par de veces por día. */
export const dynamic = "force-dynamic";

/**
 * Las páginas que queremos que Google conozca.
 *
 * Entran los eventos publicados y la tienda de quien tiene al menos uno. Una
 * tienda vacía es una página flaca, y Google castiga al sitio entero por
 * tener muchas.
 *
 * Quedan afuera los fotógrafos con dominio propio: su canónica es su dominio,
 * y un sitemap sólo puede listar direcciones del sitio que lo publica. Listar
 * acá la copia de encontrate.app sería mandarle a Google la URL que le pedimos
 * que ignore.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const fijas: MetadataRoute.Sitemap = [
    { url: `${SITIO}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITIO}/eventos`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITIO}/comparativa`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITIO}/terminos`, changeFrequency: "yearly", priority: 0.1 },
    { url: `${SITIO}/privacidad`, changeFrequency: "yearly", priority: 0.1 },
  ];

  const eventos = await db.event.findMany({
    where: {
      isPublished: true,
      NOT: { status: "ARCHIVED" },
      owner: {
        status: "ACTIVE",
        onboardingCompletedAt: { not: null },
        slug: { not: null },
        customDomains: { none: { status: "ACTIVE" } },
      },
    },
    orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }],
    select: {
      slug: true,
      updatedAt: true,
      owner: { select: { slug: true, updatedAt: true } },
    },
  });

  // La tienda cambia cuando cambia el perfil o cualquiera de sus eventos.
  const tiendas = new Map<string, Date>();
  const deEventos: MetadataRoute.Sitemap = [];

  for (const e of eventos) {
    const slug = e.owner.slug;
    // Una ruta nuestra le gana a la tienda: esa dirección no lleva a ella.
    if (!slug || slugReservado(slug)) continue;

    deEventos.push({
      url: `${SITIO}/${slug}/${e.slug}`,
      lastModified: e.updatedAt,
      changeFrequency: "weekly",
      priority: 0.8,
    });

    const ultima = e.updatedAt > e.owner.updatedAt ? e.updatedAt : e.owner.updatedAt;
    const previa = tiendas.get(slug);
    if (!previa || ultima > previa) tiendas.set(slug, ultima);
  }

  const deTiendas: MetadataRoute.Sitemap = [...tiendas].map(([slug, lastModified]) => ({
    url: `${SITIO}/${slug}`,
    lastModified,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const [posts, secciones] = await Promise.all([listarPosts(), categoriasConPosts()]);
  const delBlog: MetadataRoute.Sitemap = [
    {
      url: `${SITIO}/blog`,
      lastModified: posts[0]?.actualizado ?? posts[0]?.publicado,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    ...secciones.map((c) => ({
      url: `${SITIO}/blog/${c}`,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
    ...posts.map((p) => ({
      url: `${SITIO}/blog/${p.slug}`,
      lastModified: p.actualizado ?? p.publicado,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];

  return [...fijas, ...delBlog, ...deTiendas, ...deEventos];
}
