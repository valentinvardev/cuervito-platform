import "server-only";

import { cache } from "react";

import type { FotoSitio, PortfolioDesign } from "~/app/_portfolio/store";
import { db } from "~/server/db";
import { resolveMediaUrl } from "~/server/media";

/**
 * Lectura de portfolios para la página pública y el panel.
 *
 * Las fotos salen de PortfolioFoto → Photo, nunca de una URL guardada: si una
 * foto se borra (o se manda a la papelera) deja de aparecer sola.
 */

export const traerPortfolio = cache((ownerId: string, slug: string) =>
  db.portfolio.findUnique({
    where: { ownerId_slug: { ownerId, slug } },
    select: {
      id: true,
      nombre: true,
      slug: true,
      diseno: true,
      publicadoAt: true,
      seoTitulo: true,
      seoDescripcion: true,
      updatedAt: true,
    },
  }),
);

export type PortfolioPublico = NonNullable<Awaited<ReturnType<typeof traerPortfolio>>>;

export function disenoDe(p: { diseno: unknown }): PortfolioDesign {
  return p.diseno && typeof p.diseno === "object" ? p.diseno : {};
}

/**
 * Las fotos del portfolio, en orden, con su URL.
 *
 * En la página pública van SÓLO las que ya tienen su versión de portfolio
 * (sin marca, 1600px): mostrar la limpia de 2400 sería regalar la foto en
 * calidad de venta, y mostrar la marcada en un portfolio no tiene sentido.
 * En la vista previa del dueño, la que falta se ve con la miniatura marcada
 * mientras se genera la suya.
 */
export const fotosDePortfolio = cache(async (portfolioId: string, vistaDelDueno: boolean): Promise<FotoSitio[]> => {
  const filas = await db.portfolioFoto.findMany({
    where: {
      portfolioId,
      photo: { deletedAt: null, ...(vistaDelDueno ? {} : { portfolioKey: { not: null } }) },
    },
    orderBy: { orden: "asc" },
    select: {
      grupo: true,
      photoId: true,
      photo: {
        select: {
          portfolioKey: true,
          thumbKey: true,
          previewKey: true,
          width: true,
          height: true,
          event: { select: { eventDate: true } },
        },
      },
    },
  });
  const fotos: FotoSitio[] = [];
  for (const f of filas) {
    const clave = f.photo.portfolioKey ?? f.photo.thumbKey ?? f.photo.previewKey;
    if (!clave) continue;
    fotos.push({
      id: f.photoId,
      src: await resolveMediaUrl(clave),
      group: f.grupo,
      date: f.photo.event.eventDate?.toISOString().slice(0, 10),
    });
  }
  return fotos;
});

/** Los portfolios publicados de un fotógrafo, para el sitemap y la tienda. */
export function portfoliosPublicados(ownerId: string) {
  return db.portfolio.findMany({
    where: { ownerId, publicadoAt: { not: null } },
    orderBy: { publicadoAt: "desc" },
    select: { slug: true, nombre: true, updatedAt: true },
  });
}

/** Un número corto para un dato de portada: 860, 12 mil, 1,2 M. */
function corto(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString("es-AR", { maximumFractionDigits: 1 })} M`;
  if (n >= 10_000) return `${Math.round(n / 1000).toLocaleString("es-AR")} mil`;
  return n.toLocaleString("es-AR");
}

/**
 * Las cifras del fotógrafo para las plantillas que muestran datos: eventos
 * publicados, fotos vendidas (cobradas o regaladas) y temporadas (años
 * distintos con eventos). Las saca de encontrate, así no hay que inventarlas.
 * Un cero se devuelve vacío, que en la plantilla oculta el dato.
 */
export const cifrasDe = cache(async (ownerId: string) => {
  const [eventos, fotos, anios] = await Promise.all([
    db.event.count({ where: { ownerId, isPublished: true } }),
    db.saleItem.count({ where: { photo: { ownerId }, sale: { status: { in: ["PAID", "GIFT"] } } } }),
    db.$queryRaw<{ n: number }[]>`
      SELECT count(DISTINCT date_part('year', "eventDate"))::int AS n
      FROM "Event" WHERE "ownerId" = ${ownerId} AND "eventDate" IS NOT NULL`,
  ]);
  const temporadas = anios[0]?.n ?? 0;
  return {
    eventos: eventos ? corto(eventos) : "",
    fotos: fotos ? corto(fotos) : "",
    temporadas: temporadas ? String(temporadas) : "",
  };
});
