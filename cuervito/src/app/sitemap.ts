import { type MetadataRoute } from "next";

import { SITIO } from "~/lib/marca";
import { slugReservado } from "~/lib/slugs-reservados";
import { categoriasConPosts, listarPosts } from "~/server/blog";
import { db } from "~/server/db";
import { combosConPaginas } from "~/server/listados";

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
      // Los archivados también: su página sigue existiendo («la galería
      // cerró», con las otras ediciones), y es la que conserva lo que la
      // galería posicionó. Van al final, como algo que casi no cambia.
      OR: [{ isPublished: true, NOT: { status: "ARCHIVED" } }, { status: "ARCHIVED" }],
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
      eventDate: true,
      status: true,
      owner: { select: { slug: true, updatedAt: true } },
    },
  });

  // Un evento recién corrido cambia todos los días (suben fotos, se vende);
  // uno de hace meses, casi nunca. Decirlo es lo que hace que Google vuelva
  // seguido a los nuevos y no gaste rastreo en los viejos.
  const haceDias = (d: Date | null) => (d ? (Date.now() - d.getTime()) / 86_400_000 : 999);
  const frecuencia = (d: Date | null): "daily" | "weekly" | "monthly" =>
    haceDias(d) < 30 ? "daily" : haceDias(d) < 120 ? "weekly" : "monthly";

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
      changeFrequency: e.status === "ARCHIVED" ? "yearly" : frecuencia(e.eventDate),
      priority: e.status === "ARCHIVED" ? 0.3 : haceDias(e.eventDate) < 30 ? 0.9 : 0.7,
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

  // Los portfolios publicados, con las mismas reglas que las tiendas: dueño
  // activo, con slug propio y sin dominio propio.
  const portfolios = await db.portfolio.findMany({
    where: {
      publicadoAt: { not: null },
      fotos: { some: { photo: { deletedAt: null, portfolioKey: { not: null } } } },
      owner: {
        status: "ACTIVE",
        onboardingCompletedAt: { not: null },
        slug: { not: null },
        customDomains: { none: { status: "ACTIVE" } },
      },
    },
    select: { slug: true, updatedAt: true, owner: { select: { slug: true } } },
  });
  const dePortfolios: MetadataRoute.Sitemap = portfolios
    .filter((p) => p.owner.slug && !slugReservado(p.owner.slug))
    .map((p) => ({
      url: `${SITIO}/${p.owner.slug}/p/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.6,
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

  // Las páginas por disciplina y por provincia: sólo las que existen, que
  // son las que llegan al mínimo de eventos (ver server/listados).
  const { disciplinas, provincias } = await combosConPaginas();
  const deListados: MetadataRoute.Sitemap = [
    ...disciplinas.map((c) => ({ url: `${SITIO}/eventos/${c.slug}`, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...provincias.map((c) => ({ url: `${SITIO}/eventos/${c.slug}`, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...provincias.map((c) => ({ url: `${SITIO}/fotografos/${c.slug}`, changeFrequency: "weekly" as const, priority: 0.7 })),
  ];

  return [...fijas, ...delBlog, ...deListados, ...deTiendas, ...dePortfolios, ...deEventos];
}
