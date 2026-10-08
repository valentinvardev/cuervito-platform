import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { clasesFuentes } from "~/app/_portfolio/fuentes";
import { esPlantilla } from "~/app/_portfolio/plantillas/registro";
import { SitioPortfolio } from "~/app/_portfolio/sitio";
import type { FotoSitio } from "~/app/_portfolio/store";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { resolveMediaUrl } from "~/server/media";

/**
 * Vista de prueba de una plantilla de portfolio, con fotos reales. Sólo para
 * admins, mientras el portfolio está en desarrollo.
 *
 *   /vista-portfolio/halcyon?fotografo=<slug>&eventos=3&porEvento=8
 *
 * Toma los últimos eventos publicados del fotógrafo (por defecto, el admin
 * que mira) y unas fotos de cada uno, agrupadas por evento como las va a
 * agrupar el portfolio. Usa la versión sin marca de agua (previewCleanKey):
 * es la del dueño, y acá sólo la ven admins. La del portfolio público va a
 * ser otra, más chica.
 *
 * No va en /admin porque allá todo va dentro del riel del panel, y lo que se
 * prueba es la página a ancho completo, como la va a ver un visitante.
 */

export const metadata: Metadata = {
  title: "Vista de portfolio",
  robots: { index: false, follow: false },
};

export default async function VistaPortfolio({
  params,
  searchParams,
}: {
  params: Promise<{ plantilla: string }>;
  searchParams: Promise<{ fotografo?: string; eventos?: string; porEvento?: string }>;
}) {
  // Para cualquiera que no sea admin, la ruta no existe.
  const sesion = await auth();
  if (sesion?.user?.role !== "ADMIN") notFound();

  const { plantilla } = await params;
  if (!esPlantilla(plantilla)) notFound();

  const q = await searchParams;
  const cantEventos = Math.min(Math.max(Number(q.eventos) || 3, 1), 8);
  const porEvento = Math.min(Math.max(Number(q.porEvento) || 8, 1), 24);

  const fotografo = await db.user.findFirst({
    where: q.fotografo ? { slug: q.fotografo } : { id: sesion.user.id },
    select: { id: true, name: true, location: true, instagramUrl: true, websiteUrl: true },
  });
  if (!fotografo) notFound();

  const eventos = await db.event.findMany({
    where: {
      ownerId: fotografo.id,
      isPublished: true,
      photos: { some: { deletedAt: null, previewCleanKey: { not: null } } },
    },
    orderBy: { eventDate: "desc" },
    take: cantEventos,
    select: {
      name: true,
      eventDate: true,
      photos: {
        where: { deletedAt: null, previewCleanKey: { not: null } },
        orderBy: { createdAt: "asc" },
        take: porEvento,
        select: { previewCleanKey: true, filename: true },
      },
    },
  });

  const fotos: FotoSitio[] = [];
  for (const ev of eventos) {
    for (const f of ev.photos) {
      fotos.push({
        src: await resolveMediaUrl(f.previewCleanKey!),
        group: ev.name,
        date: ev.eventDate?.toISOString().slice(0, 10),
      });
    }
  }

  const ua = (await headers()).get("user-agent") ?? "";
  const viewportInicial = /Mobi|Android|iPhone/i.test(ua) ? "mobile" : "desktop";

  return (
    <div className={clasesFuentes}>
      <SitioPortfolio
        diseno={{ templateId: plantilla }}
        perfil={{
          nombre: fotografo.name ?? "Tu nombre",
          ubicacion: fotografo.location,
          instagram: fotografo.instagramUrl,
          web: fotografo.websiteUrl,
        }}
        fotos={fotos}
        slug={null}
        viewportInicial={viewportInicial}
      />
    </div>
  );
}
