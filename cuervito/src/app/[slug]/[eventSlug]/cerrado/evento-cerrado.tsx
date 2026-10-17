import "~/styles/evento-privado.css";

import { ArrowRight, Archive } from "lucide-react";
import Link from "next/link";

import { buildTemplateStyle, getTemplate } from "~/lib/storefront-templates";
import { urlPublica } from "~/lib/url-publica";
import { resolveAvatarUrl } from "~/server/avatar";
import { db } from "~/server/db";
import type { Edicion } from "~/server/eventos-relacionados";
import { resolveMediaUrl } from "~/server/media";

import { type Evento, type Fotografo } from "../../_datos";

/**
 * La página de un evento archivado: la galería cerró, pero la página sigue.
 *
 * Una galería vende dos semanas; la búsqueda «fotos [carrera] [año]» dura
 * meses, y al año siguiente la misma carrera vuelve. Si archivar sacara la
 * página (antes era el aviso de evento privado, con noindex), lo que esa
 * página ganó en Google se perdería con ella. Así que se queda, indexable, y
 * manda a donde sí hay algo: la página del fotógrafo, sus últimos eventos y
 * las otras ediciones de la misma carrera.
 *
 * Al archivar se borran las fotos y la portada (ver dashboard/_nucleo.ts),
 * así que acá no hay imagen: es texto y enlaces. Con la marca de la tienda,
 * como la página de evento privado.
 */
export async function EventoCerrado({
  fotografo,
  slug,
  evento,
  ediciones,
}: {
  fotografo: Fotografo;
  slug: string;
  evento: Evento;
  ediciones: Edicion[];
}) {
  const plantilla = getTemplate(fotografo.storefrontTemplate);
  const estilo = buildTemplateStyle(
    fotografo.storefrontTemplate,
    fotografo.storefrontBrandColor,
    fotografo.storefrontBrandColor2,
  );
  const nombre = fotografo.name ?? "el fotógrafo";
  const dominio = fotografo.customDomains[0]?.hostname;

  const [avatarUrl, logoUrl, recientes] = await Promise.all([
    resolveAvatarUrl(fotografo.image),
    fotografo.logoKey ? resolveMediaUrl(fotografo.logoKey) : null,
    // Lo último que publicó: es adonde conviene mandar a quien llegó acá.
    db.event.findMany({
      where: { ownerId: fotografo.id, isPublished: true, NOT: { status: "ARCHIVED" } },
      orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }],
      take: 3,
      select: { slug: true, name: true, eventDate: true },
    }),
  ]);
  const iniciales =
    fotografo.name
      ?.split(" ")
      .map((p) => p[0]?.toUpperCase() ?? "")
      .filter(Boolean)
      .slice(0, 2)
      .join("") ?? "?";

  // La fecha del evento va en UTC (se guarda a medianoche UTC); la de cierre
  // es la última modificación, que es el archivado mismo.
  const fecha = (d: Date | null, zona: string) =>
    d ? d.toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric", timeZone: zona }) : null;
  const fechaEvento = fecha(evento.eventDate, "UTC");
  const cerro = fecha(evento.updatedAt, "America/Argentina/Buenos_Aires");
  const encontrate = plantilla.layout === "encontrate";

  return (
    <div className={encontrate ? "et ep-pagina" : "ep-pagina ep-clasica"} style={estilo}>
      {encontrate ? (
        <header className="et-top">
          <Link href={`/${slug}`} className="et-marca">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="et-logo" src={logoUrl} alt={nombre} />
            ) : (
              <>
                <span className="et-av">
                  {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarUrl} alt="" />
                  ) : (
                    iniciales
                  )}
                </span>
                <span className="et-quien">
                  <b>{nombre}</b>
                  <span>encontrate.app/{slug}</span>
                </span>
              </>
            )}
          </Link>
        </header>
      ) : (
        <nav className="nav">
          <div className="nav-left">
            <Link href={`/${slug}`} aria-label={`Eventos de ${nombre}`}>
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt={nombre} className="storefront-logo" />
              ) : (
                <span className="ep-nombre-nav">{nombre}</span>
              )}
            </Link>
          </div>
        </nav>
      )}

      <main className="ep">
        <div className="ep-caja">
          <span className="ep-icono" aria-hidden="true">
            <Archive />
          </span>
          <span className="ep-evento">
            {evento.name}
            {fechaEvento && <> · {fechaEvento}</>}
          </span>

          <h1>Fotos de {evento.name}: la galería cerró.</h1>
          <p>
            Esta galería de {nombre} cerró{cerro ? ` el ${cerro}` : ""}. Las fotos ya no están a la venta; si compraste
            alguna, el link que te llegó por mail sigue sirviendo hasta que vence.
          </p>

          {recientes.length > 0 && (
            <div className="ep-lista">
              <span className="ep-lista-t">Lo último de {nombre}</span>
              {recientes.map((e) => (
                <a key={e.slug} href={urlPublica(slug, dominio, e.slug)}>
                  <span>{e.name}</span>
                  {e.eventDate && <small>{fecha(e.eventDate, "UTC")}</small>}
                </a>
              ))}
            </div>
          )}

          {ediciones.length > 0 && (
            <div className="ep-lista">
              <span className="ep-lista-t">Otras ediciones de esta carrera</span>
              {ediciones.map((e) => (
                <a key={e.url} href={e.url}>
                  <span>
                    {e.nombre}
                    {e.anio ? ` · ${e.anio}` : ""}
                  </span>
                  <small>{e.fotografo}</small>
                </a>
              ))}
            </div>
          )}

          <Link href={`/${slug}`} className="ep-otros">
            Ver todos los eventos de {nombre} <ArrowRight />
          </Link>
        </div>
      </main>
    </div>
  );
}
