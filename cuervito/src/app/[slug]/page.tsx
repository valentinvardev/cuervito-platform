import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import "~/styles/tienda-perfil.css";

import { ciudadDe } from "~/lib/disciplinas";
import { urlPublica } from "~/lib/url-publica";
import { resolveMediaUrl } from "~/server/media";

import { traerFotografo } from "./_datos";
import { perfilDerivado, textoPerfil } from "./_resumen";
import { Tienda } from "./_tienda";

export async function generateMetadata(props: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await props.params;
  const user = await traerFotografo(slug);
  if (!user) return {};

  const nombre = user.name ?? "Fotógrafo";
  // «fotógrafo deportivo en [ciudad]» es lo que busca un organizador. Sin
  // ciudad en el perfil, el título no la inventa.
  const ciudad = ciudadDe(user.location);
  const titulo = `${nombre} · Fotógrafo deportivo${ciudad ? ` en ${ciudad}` : ""}`;
  // La descripción se arma con sus eventos (disciplinas, cantidades), no con
  // la bio: la bio habla de la persona; esto dice qué va a encontrar quien
  // busca.
  const descripcion = textoPerfil(ciudad, await perfilDerivado(user.id));
  const url = urlPublica(slug, user.customDomains[0]?.hostname);

  return {
    title: titulo,
    description: descripcion,
    alternates: { canonical: url },
    openGraph: { type: "profile", title: titulo, description: descripcion, url },
    twitter: { title: titulo, description: descripcion },
  };
}

function NavSkeleton({ logoUrl }: { logoUrl: string | null }) {
  return (
    <nav className="nav">
      <div className="nav-left">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="storefront-logo" />
        ) : (
          <span className="logo" aria-hidden="true">
            cuerv<span className="logo-dot" />to
          </span>
        )}
      </div>
    </nav>
  );
}

/* El esqueleto vivía en el layout, alrededor de todo lo de abajo. Bajó acá
   para que el layout pueda responder 404 (ver layout.tsx); la tienda lo sigue
   teniendo igual, con el logo del fotógrafo mientras cargan los eventos.

   La página en sí está en _tienda.tsx, porque también la dibuja /vista-tienda
   con otra plantilla: es la previa del panel. */
export default async function PhotographerPage(props: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await props.params;
  // El layout ya respondió 404 si no existe; esto es para el tipo.
  const user = await traerFotografo(slug);
  if (!user) notFound();

  const logoUrl = user.logoKey ? await resolveMediaUrl(user.logoKey) : null;

  return (
    <Suspense fallback={<NavSkeleton logoUrl={logoUrl} />}>
      <Tienda slug={slug} user={user} logoUrl={logoUrl} plantilla={user.storefrontTemplate} />
    </Suspense>
  );
}
