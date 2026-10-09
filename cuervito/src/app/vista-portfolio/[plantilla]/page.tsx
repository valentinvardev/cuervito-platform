import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { clasesFuentes } from "~/app/_portfolio/fuentes";
import { esPlantilla } from "~/app/_portfolio/plantillas/registro";
import { SitioPortfolio } from "~/app/_portfolio/sitio";
import type { FotoSitio } from "~/app/_portfolio/store";
import { puedeUsarPortfolio } from "~/lib/portfolio-acceso";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { resolveMediaUrl } from "~/server/media";
import { cifrasDe, eventosDe } from "~/server/portfolio";

/**
 * Una plantilla de portfolio armada con fotos reales, antes de que exista el
 * portfolio. La usa el asistente para mostrar cada plantilla con las fotos
 * elegidas (en un iframe), y sirve para probar plantillas a mano:
 *
 *   /vista-portfolio/halcyon?fotos=<id>,<id>,…   fotos propias, en ese orden
 *   /vista-portfolio/halcyon?fotografo=<slug>     (admins) los últimos eventos
 *                                                 publicados de ese fotógrafo
 *
 * Las fotos van con la miniatura de 560px marcada: es una vista de elegir,
 * dentro del panel, y mostrar acá la limpia sería servirla a cualquiera que
 * arme la URL con ids ajenos. Por eso también, con `fotos`, sólo cuentan las
 * del usuario que mira.
 *
 * No va en /dashboard porque allá todo va dentro del riel del panel, y lo que
 * se ve es la página a ancho completo, como la va a ver un visitante.
 */

export const metadata: Metadata = {
  title: "Vista de portfolio",
  robots: { index: false, follow: false },
};

type Busqueda = { fotos?: string; fotografo?: string; eventos?: string; porEvento?: string };

export default async function VistaPortfolio({
  params,
  searchParams,
}: {
  params: Promise<{ plantilla: string }>;
  searchParams: Promise<Busqueda>;
}) {
  const sesion = await auth();
  const yo = sesion?.user;
  // Para quien no puede usar Portfolio, la ruta no existe.
  if (!yo?.id || !puedeUsarPortfolio(yo.role)) notFound();

  const { plantilla } = await params;
  if (!esPlantilla(plantilla)) notFound();
  const q = await searchParams;

  // De quién son las fotos: el que mira, salvo un admin pidiendo otro.
  const fotografo = await db.user.findFirst({
    where: q.fotografo && yo.role === "ADMIN" ? { slug: q.fotografo } : { id: yo.id },
    select: { id: true, slug: true, name: true, location: true, instagramUrl: true, websiteUrl: true },
  });
  if (!fotografo) notFound();

  const fotos: FotoSitio[] = [];
  const ids = (q.fotos ?? "").split(",").filter(Boolean).slice(0, 80);

  if (ids.length > 0) {
    const filas = await db.photo.findMany({
      where: { id: { in: ids }, ownerId: fotografo.id, deletedAt: null },
      select: { id: true, thumbKey: true, previewKey: true, event: { select: { name: true, eventDate: true } } },
    });
    const porId = new Map(filas.map((f) => [f.id, f]));
    for (const id of ids) {
      const f = porId.get(id);
      const clave = f?.thumbKey ?? f?.previewKey;
      if (f && clave) {
        fotos.push({ id, src: await resolveMediaUrl(clave), group: f.event.name, date: f.event.eventDate?.toISOString().slice(0, 10) });
      }
    }
  } else {
    const cantEventos = Math.min(Math.max(Number(q.eventos) || 3, 1), 8);
    const porEvento = Math.min(Math.max(Number(q.porEvento) || 8, 1), 24);
    const eventos = await db.event.findMany({
      where: { ownerId: fotografo.id, isPublished: true, photos: { some: { deletedAt: null, thumbKey: { not: null } } } },
      orderBy: { eventDate: "desc" },
      take: cantEventos,
      select: {
        name: true,
        eventDate: true,
        photos: {
          where: { deletedAt: null, thumbKey: { not: null } },
          orderBy: { createdAt: "asc" },
          take: porEvento,
          select: { thumbKey: true },
        },
      },
    });
    for (const ev of eventos) {
      for (const f of ev.photos) {
        fotos.push({ src: await resolveMediaUrl(f.thumbKey!), group: ev.name, date: ev.eventDate?.toISOString().slice(0, 10) });
      }
    }
  }

  const ua = (await headers()).get("user-agent") ?? "";
  const [cifras, publicados] = await Promise.all([
    cifrasDe(fotografo.id),
    fotografo.slug ? eventosDe(fotografo.id, fotografo.slug, null) : [],
  ]);

  return (
    <div className={clasesFuentes}>
      <SitioPortfolio
        diseno={{ templateId: plantilla }}
        perfil={{
          nombre: fotografo.name ?? "Tu nombre",
          ubicacion: fotografo.location,
          instagram: fotografo.instagramUrl,
          web: fotografo.websiteUrl,
          cifras,
          eventos: publicados,
        }}
        fotos={fotos}
        slug={null}
        viewportInicial={/Mobi|Android|iPhone/i.test(ua) ? "mobile" : "desktop"}
      />
    </div>
  );
}
