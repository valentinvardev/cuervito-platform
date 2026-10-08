import "~/styles/evento-privado.css";

import { ArrowRight, Lock } from "lucide-react";
import Link from "next/link";

import { buildTemplateStyle, getTemplate } from "~/lib/storefront-templates";
import { resolveAvatarUrl } from "~/server/avatar";
import { resolveMediaUrl } from "~/server/media";

import { type Evento, type Fotografo } from "../../_datos";
import { FormularioPedido } from "./formulario";

/**
 * La página de un evento que existe pero no está a la venta.
 *
 * Antes era un 404: el que llegaba por un link que el fotógrafo pasó antes de
 * publicar —en el grupo del club, en una historia— se encontraba con «página
 * no encontrada» y se iba creyendo que el link estaba roto. Las fotos existen;
 * sólo falta un botón. Esta página lo dice, y le da al visitante algo para
 * hacer: avisarle al fotógrafo y, si quiere, enterarse cuando salga.
 *
 * Se ve con la marca de cada tienda: los colores salen de las mismas
 * variables que usa el tema (buildTemplateStyle), y el encabezado es el de la
 * plantilla —el de encontrate o el de las clásicas—. Lo de adentro es uno
 * solo, porque lo que tiene que decir es lo mismo en todas.
 *
 * Un evento archivado también cae acá, pero sin formulario: no va a volver.
 */
export async function EventoPrivado({
  fotografo,
  slug,
  evento,
}: {
  fotografo: Fotografo;
  slug: string;
  evento: Evento;
}) {
  const plantilla = getTemplate(fotografo.storefrontTemplate);
  const estilo = buildTemplateStyle(fotografo.storefrontTemplate, fotografo.storefrontBrandColor);
  const nombre = fotografo.name ?? "el fotógrafo";
  const primerNombre = fotografo.name?.split(" ")[0] ?? "el fotógrafo";
  const archivado = evento.status === "ARCHIVED";

  const [avatarUrl, logoUrl] = await Promise.all([
    resolveAvatarUrl(fotografo.image),
    fotografo.logoKey ? resolveMediaUrl(fotografo.logoKey) : null,
  ]);
  const iniciales =
    fotografo.name
      ?.split(" ")
      .map((p) => p[0]?.toUpperCase() ?? "")
      .filter(Boolean)
      .slice(0, 2)
      .join("") ?? "?";

  const fecha = evento.eventDate
    ? evento.eventDate.toLocaleDateString("es-AR", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "America/Argentina/Buenos_Aires",
      })
    : null;

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
            <Lock />
          </span>
          <span className="ep-evento">
            {evento.name}
            {fecha && <> · {fecha}</>}
          </span>

          {archivado ? (
            <>
              <h1>Este evento ya no está disponible.</h1>
              <p>{nombre} lo sacó de su página. Si ya compraste fotos, el link que te llegó por mail sirve hasta que vence.</p>
            </>
          ) : (
            <>
              <h1>Las fotos todavía no están publicadas.</h1>
              <p>
                {nombre} todavía no publicó este evento, así que las fotos no se pueden ver ni
                comprar. Avisale que las querés: le llega un mail en el momento.
              </p>
              <FormularioPedido eventId={evento.id} nombre={primerNombre} />
            </>
          )}

          <Link href={`/${slug}`} className="ep-otros">
            Ver los otros eventos de {nombre} <ArrowRight />
          </Link>
        </div>
      </main>
    </div>
  );
}
