import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { JsonLd } from "~/app/_components/json-ld";
import { buildTemplateStyle, getTemplate } from "~/lib/storefront-templates";
import { urlPublica } from "~/lib/url-publica";
import { resolveAvatarUrl } from "~/server/avatar";
import { db } from "~/server/db";
import { tonoDeLogo } from "~/server/logo-tono";
import { getPresignedDownloadUrl } from "~/server/s3";
import { ahora, lento } from "~/server/medir";
import { resolveMediaUrl, urlDerivado } from "~/server/media";
import { getMpTestMode } from "~/server/settings";

import { estaALaVenta, traerEvento, traerFotografo } from "../_datos";
import { EncontrateShell } from "./encontrate/shell";
import { GaleriaProgresiva } from "./galeria-progresiva";
import { EventoPrivado } from "./privado/evento-privado";

/** Fotos en la primera tanda. Tiene que coincidir con el endpoint. */
const TANDA = 60;

/** La portada en una URL que se pueda compartir. Con CloudFront es estable. */
const urlPortada = cache(async (coverUrl: string | null) =>
  coverUrl ? (coverUrl.startsWith("http") ? coverUrl : await resolveMediaUrl(coverUrl)) : null,
);

/** Cómo encuentra el atleta sus fotos en este evento, para los textos de búsqueda. */
function comoSeBusca(e: { recognition: boolean; bibDetection: boolean }): string {
  if (!e.recognition) return "en la galería";
  return e.bibDetection ? "por número de dorsal o con una selfie" : "con una selfie";
}

/* El título es lo que se busca: «fotos maratón de rosario». Hasta acá todas
   las páginas de evento heredaban el título de la landing, así que para Google
   eran cientos de páginas que decían lo mismo. */
export async function generateMetadata(props: {
  params: Promise<{ slug: string; eventSlug: string }>;
}): Promise<Metadata> {
  const { slug, eventSlug } = await props.params;
  const photographer = await traerFotografo(slug);
  if (!photographer) return {};
  const event = await traerEvento(photographer.id, eventSlug);
  if (!event) return {};
  // Sin publicar: se ve el aviso, pero no es una página para los buscadores.
  if (!estaALaVenta(event)) {
    return {
      title: `${event.name} · ${photographer.name ?? "Fotógrafo"}`,
      robots: { index: false, follow: false },
    };
  }

  const fecha = event.eventDate
    ? event.eventDate.toLocaleDateString("es-AR", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "America/Argentina/Buenos_Aires",
      })
    : null;
  const fotografo = photographer.name ?? "el fotógrafo";
  const como = comoSeBusca(event);

  const titulo = `Fotos de ${event.name}${fecha ? ` · ${fecha}` : ""}`;
  const descripcion = `Buscá tus fotos de ${event.name}${event.location ? ` en ${event.location}` : ""} ${como}. Fotos de ${fotografo}: comprás y descargás al instante, sin crear cuenta.`;
  const url = urlPublica(slug, photographer.customDomains[0]?.hostname, event.slug);
  const portada = await urlPortada(event.coverUrl);

  return {
    title: titulo,
    description: descripcion,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      title: titulo,
      description: descripcion,
      url,
      ...(portada ? { images: [{ url: portada, alt: event.name }] } : {}),
    },
    twitter: {
      card: portada ? "summary_large_image" : "summary",
      title: titulo,
      description: descripcion,
      ...(portada ? { images: [portada] } : {}),
    },
  };
}

export default async function PublicEventPage(props: {
  params: Promise<{ slug: string; eventSlug: string }>;
}) {
  const { slug, eventSlug } = await props.params;

  // El layout ya respondió 404 si alguno de los dos no existe; esto es para
  // el tipo.
  const photographer = await traerFotografo(slug);
  if (!photographer) notFound();
  const event = await traerEvento(photographer.id, eventSlug);
  if (!event) notFound();

  if (!estaALaVenta(event)) {
    return <EventoPrivado fotografo={photographer} slug={slug} evento={event} />;
  }

  const coverSignedUrl = await urlPortada(event.coverUrl);

  // Load all committed photos. We require `previewKey` to exist —
  // without it the falling back to `storageKey` would leak the original
  // un-watermarked image to the public storefront. The owner sees photos
  // in the dashboard immediately after upload; the public gallery only
  // catches up once the background watermark finishes (a few seconds
  // after the commit returns).
  /* La PRIMERA tanda, no todas.

     Acá se traían las 2.162 fotos del evento para una pantalla que muestra
     24. Medido contra producción: Postgres resuelve esa consulta en 3
     milisegundos, pero mover las 783 KB de resultado desde Supabase hasta el
     VPS tardaba TREINTA SEGUNDOS. El cuello nunca fue la base ni un índice
     que faltara —el plan es un Bitmap Index Scan perfecto— sino la cantidad
     de datos cruzando la red en cada visita.

     Se piden 61 para saber si hay una tanda más sin gastar una segunda
     consulta contando. El resto lo pide el navegador a /api/evento/…/fotos
     cuando hace falta. */
  const layout = getTemplate(photographer.storefrontTemplate).layout;

  const tFotos = ahora();
  const donde = {
    eventId: event.id,
    fileSize: { not: null },
    deletedAt: null,
    previewKey: { not: null },
  } as const;

  const [primeras, totalFotos] = await Promise.all([
    db.photo.findMany({
      where: donde,
      // El desempate por id no es adorno: en una tanda de subida hay decenas
      // de fotos con el mismo createdAt al segundo, y un cursor que sólo mira
      // la fecha saltea o repite justo ahí.
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: TANDA + 1,
      select: {
        id: true,
        // storageKey NO: es el original sin marca de agua y no se usa en esta
        // pantalla. Traerlo son 136 bytes por foto que viajan para nada.
        previewKey: true,
        // La miniatura de 560px. Nula en las fotos anteriores al cambio: ahí
        // se cae al preview de 2400px, que es lento pero se ve.
        thumbKey: true,
        // La versión de las dos URLs: cambia al regenerar la marca (urlDerivado).
        previewGeneratedAt: true,
        bibNumbers: true,
        width: true,
        height: true,
      },
    }),
    // El total sigue haciendo falta para el «2.162 fotos» del encabezado.
    // Es un count por índice sobre un solo evento: no cuesta nada.
    db.photo.count({ where: donde }),
  ]);
  lento("evento · traer fotos", tFotos);

  const hayMas = primeras.length > TANDA;
  const rawPhotos = hayMas ? primeras.slice(0, TANDA) : primeras;
  const cursorInicial = hayMas ? (rawPhotos[rawPhotos.length - 1]?.id ?? null) : null;

  const tUrls = ahora();
  const photos = await Promise.all(
    rawPhotos.map(async (p) => ({
      id: p.id,
      previewUrl: await urlDerivado(p.thumbKey ?? p.previewKey!, p.previewGeneratedAt),
      fullUrl: await urlDerivado(p.previewKey!, p.previewGeneratedAt),
      bibNumbers: p.bibNumbers,
      width: p.width,
      height: p.height,
    })),
  );
  lento(`evento · resolver ${photos.length} urls`, tUrls);

  // Active discounts for nudge display and checkout
  const now = new Date();
  const discounts = await db.discount.findMany({
    where: {
      eventId: event.id,
      OR: [{ expires: null }, { expires: { gt: now } }],
    },
    select: {
      // SIN `code`: esto viaja al navegador. Con el código adentro, todos los
      // cupones del evento quedaban en el HTML de la página de venta y los
      // leía cualquiera con las herramientas de desarrollo, que es
      // exactamente lo contrario de para qué existe un código.
      id: true, type: true, kind: true, value: true,
      qty: true, price: true, expires: true, maxUses: true, usageCount: true,
    },
  });
  const activeDiscounts = discounts
    .filter((d) => d.maxUses === null || d.usageCount < d.maxUses)
    .map((d) => ({
      ...d,
      value: d.value ? Number(d.value) : null,
      price: d.price ? Number(d.price) : null,
      expires: d.expires?.toISOString() ?? null,
    }));

  const initials =
    photographer.name
      ?.split(" ")
      .map((p) => p[0]?.toUpperCase() ?? "")
      .filter(Boolean)
      .slice(0, 2)
      .join("") || "?";

  const [avatarUrl, logoUrl, logoTono, testMode] = await Promise.all([
    resolveAvatarUrl(photographer.image),
    photographer.logoKey
      ? resolveMediaUrl(photographer.logoKey)
      : null,
    // Sólo la plantilla clara lo usa; las otras no pagan la medición.
    layout === "encontrate" ? tonoDeLogo(photographer.id, photographer.logoKey) : null,
    getMpTestMode(),
  ]);

  const pageStyle = {
    ...buildTemplateStyle(photographer.storefrontTemplate, photographer.storefrontBrandColor),
    // Derive accent hover/tint variables from brand color
    ...(photographer.storefrontBrandColor
      ? {
          "--accent-bright": `color-mix(in srgb, ${photographer.storefrontBrandColor} 85%, white)`,
          "--accent-deep":   `color-mix(in srgb, ${photographer.storefrontBrandColor} 12%, transparent)`,
          "--border-accent": `color-mix(in srgb, ${photographer.storefrontBrandColor} 40%, transparent)`,
        }
      : {}),
  } as React.CSSProperties;

  /* Este evento se regala.
     
     Dos condiciones, no una: el precio en cero lo pone el fotógrafo, pero el
     permiso lo damos nosotros. Sin el permiso, un evento en cero no es gratis
     —es un evento sin precio cargado— y la tienda no puede prometer algo que
     el checkout va a rechazar.
     
     Es la misma cuenta que hace el checkout, y por eso sólo cambia lo que se
     lee: el precio de verdad lo decide el servidor cuando se compra. Si las
     dos se separaran, mandaría el checkout. */
  const regalo = Number(event.pricePerPhoto) === 0 && photographer.giftEnabled;

  const shellProps = {
    photographer: {
      slug,
      name: photographer.name ?? "Fotógrafo",
      bio: photographer.bio,
      location: photographer.location,
      instagramUrl: photographer.instagramUrl,
      initials,
      avatarUrl,
      logoUrl,
      logoTono,
    },
    event: {
      id: event.id,
      slug: event.slug,
      name: event.name,
      description: event.description,
      discipline: event.discipline,
      location: event.location,
      eventDate: event.eventDate?.toISOString() ?? null,
      coverUrl: coverSignedUrl,
      pricePerPhoto: Number(event.pricePerPhoto),
      currency: event.currency,
      photosCount: totalFotos,
    },
    photos,
    cursorInicial,
    discounts: activeDiscounts,
    testMode,
    regalo,
  };

  /* Lo mismo que dice la página, en la forma en que lo lee un agente: qué
     evento, cuándo, dónde, de quién son las fotos y cuánto cuestan. La
     galería es la página; el evento es de lo que trata.

     Google lee el evento de `about` como un Event aparte y le pide sus
     campos. Van los que son ciertos: imagen (la portada o, sin portada, la
     primera foto), descripción (la del fotógrafo o una armada con los datos
     del evento) y estado: no hay forma de marcar un evento cancelado, así que
     es «programado». Quedan afuera dos a propósito: `organizer`, porque no
     sabemos quién organiza la carrera y el fotógrafo no lo es; y `offers`,
     porque en un Event son entradas, y acá no se venden entradas sino fotos
     (ese precio va en el Offer de la galería, más abajo).

     Sin fecha o sin lugar no es un Event válido para Google (son los dos
     campos obligatorios): ahí se dice sólo de qué trata, sin tipo de evento. */
  const imagen = coverSignedUrl ?? photos[0]?.previewUrl ?? null;
  const propia = event.description?.trim();
  const descripcion = propia?.length
    ? propia
    : `${event.name}${event.location ? `, ${event.location}` : ""}. Fotos de ${photographer.name ?? "el fotógrafo"}: buscá las tuyas ${comoSeBusca(event)}.`;
  const datosEstructurados = {
    "@context": "https://schema.org",
    "@type": "ImageGallery",
    name: `Fotos de ${event.name}`,
    url: urlPublica(slug, photographer.customDomains[0]?.hostname, event.slug),
    description: descripcion,
    ...(imagen ? { image: imagen } : {}),
    inLanguage: "es-AR",
    author: { "@type": "Person", name: photographer.name ?? "Fotógrafo" },
    about:
      event.eventDate && event.location
        ? {
            "@type": "SportsEvent",
            name: event.name,
            description: descripcion,
            ...(imagen ? { image: imagen } : {}),
            startDate: event.eventDate.toISOString().slice(0, 10),
            eventStatus: "https://schema.org/EventScheduled",
            eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
            location: { "@type": "Place", name: event.location, address: event.location },
            ...(event.discipline ? { sport: event.discipline } : {}),
          }
        : { "@type": "Thing", name: event.name },
    ...(regalo
      ? { isAccessibleForFree: true }
      : {
          offers: {
            "@type": "Offer",
            price: Number(event.pricePerPhoto),
            priceCurrency: event.currency,
            description: "Precio por foto",
          },
        }),
  };

  return (
    <div style={pageStyle}>
      <JsonLd datos={datosEstructurados} />
      {layout === "encontrate" ? (
        <EncontrateShell {...shellProps} buscaPorDorsal={event.bibDetection} />
      ) : (
        /* Las viejas filtran en el navegador, así que necesitan tener todas
           las fotos —pero NO antes de dibujar—. Abren con las primeras 60 y
           el resto cae solo por detrás. */
        <GaleriaProgresiva layout={layout} {...shellProps} />
      )}
    </div>
  );
}
