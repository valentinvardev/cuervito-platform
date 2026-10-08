import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { after } from "next/server";

import { JsonLd } from "~/app/_components/json-ld";
import { clasesFuentes } from "~/app/_portfolio/fuentes";
import { SitioPortfolio } from "~/app/_portfolio/sitio";
import { urlPublica } from "~/lib/url-publica";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { cifrasDe, disenoDe, fotosDePortfolio, traerPortfolio } from "~/server/portfolio";

import { traerFotografo } from "../../_datos";
import { consultarPortfolio } from "./acciones";

/**
 * La página pública de un portfolio: /{fotógrafo}/p/{portfolio}.
 *
 * Se genera en el servidor entera —textos, fotos, datos estructurados—, que es
 * lo que la diferencia de la de photo-saas, donde Google recibía un <div>
 * vacío. El 404 lo decide el layout de /[slug] (fotógrafo inexistente) y esta
 * página (portfolio inexistente, o borrador mirado por alguien que no es el
 * dueño). Sin <Suspense> arriba, así el 404 sale como 404.
 */

type Props = { params: Promise<{ slug: string; portfolio: string }> };

/** Un borrador lo ve sólo su dueño; para cualquier otro no existe. */
async function cargar(slug: string, portfolioSlug: string) {
  const fotografo = await traerFotografo(slug);
  if (!fotografo) return null;
  const p = await traerPortfolio(fotografo.id, portfolioSlug);
  if (!p) return null;
  const esDueno = p.publicadoAt ? false : (await auth())?.user?.id === fotografo.id;
  if (!p.publicadoAt && !esDueno) return null;
  return { fotografo, p, esDueno };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, portfolio } = await params;
  const d = await cargar(slug, portfolio);
  if (!d) return {};
  const { fotografo, p } = d;
  const nombre = fotografo.name ?? slug;
  const titulo = p.seoTitulo ?? `${nombre} · Portfolio`;
  const descripcion =
    p.seoDescripcion ?? fotografo.bio?.slice(0, 160) ?? `Fotografía deportiva de ${nombre}.`;
  const url = urlPublica(slug, fotografo.customDomains[0]?.hostname, `p/${p.slug}`);
  const fotos = await fotosDePortfolio(p.id, d.esDueno);
  const portada = fotos[0]?.src;
  return {
    title: titulo,
    description: descripcion,
    alternates: { canonical: url },
    // El borrador sólo lo ve su dueño, pero por las dudas: nunca al índice.
    robots: p.publicadoAt ? undefined : { index: false, follow: false },
    openGraph: { title: titulo, description: descripcion, url, type: "profile", images: portada ? [{ url: portada }] : undefined },
    twitter: { card: portada ? "summary_large_image" : "summary", title: titulo, description: descripcion },
  };
}

export default async function PaginaPortfolio({ params }: Props) {
  const { slug, portfolio } = await params;
  const d = await cargar(slug, portfolio);
  if (!d) notFound();
  const { fotografo, p, esDueno } = d;

  const [fotos, cifras] = await Promise.all([fotosDePortfolio(p.id, esDueno), cifrasDe(fotografo.id)]);
  const ua = (await headers()).get("user-agent") ?? "";

  // La visita se cuenta después de responder, y no las del dueño ni las de
  // los robots: el número es para saber si alguien lo mira.
  if (!esDueno && !/bot|crawl|spider|preview|lighthouse/i.test(ua)) {
    after(() =>
      db.portfolio
        .update({ where: { id: p.id }, data: { vistas: { increment: 1 } } })
        .catch((e: unknown) => console.error("[portfolio] vista:", e)),
    );
  }

  const nombre = fotografo.name ?? slug;
  const url = urlPublica(slug, fotografo.customDomains[0]?.hostname, `p/${p.slug}`);
  const redes = [fotografo.instagramUrl, fotografo.websiteUrl].filter((x): x is string => Boolean(x));

  return (
    <div className={clasesFuentes}>
      <JsonLd
        datos={{
          "@context": "https://schema.org",
          "@type": "ProfilePage",
          url,
          name: p.seoTitulo ?? `${nombre} · Portfolio`,
          dateModified: p.updatedAt.toISOString(),
          mainEntity: {
            "@type": "Person",
            name: nombre,
            jobTitle: "Fotógrafo deportivo",
            ...(fotografo.location ? { homeLocation: fotografo.location } : {}),
            ...(redes.length ? { sameAs: redes } : {}),
            url: urlPublica(slug, fotografo.customDomains[0]?.hostname),
          },
          hasPart: {
            "@type": "ImageGallery",
            name: p.nombre,
            image: fotos.slice(0, 30).map((f) => ({
              "@type": "ImageObject",
              contentUrl: f.src,
              ...(f.group ? { caption: f.group } : {}),
              creator: { "@type": "Person", name: nombre },
              copyrightNotice: `© ${nombre}`,
            })),
          },
        }}
      />
      <SitioPortfolio
        diseno={disenoDe(p)}
        perfil={{
          nombre,
          ubicacion: fotografo.location,
          instagram: fotografo.instagramUrl,
          web: fotografo.websiteUrl,
          cifras,
        }}
        fotos={fotos}
        slug={slug}
        viewportInicial={/Mobi|Android|iPhone/i.test(ua) ? "mobile" : "desktop"}
        // Un borrador no recibe consultas: el formulario se ve, pero no manda.
        enviarConsulta={p.publicadoAt ? consultarPortfolio.bind(null, p.id) : undefined}
      />
    </div>
  );
}
