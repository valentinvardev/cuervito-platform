import type { Metadata } from "next";
import { notFound } from "next/navigation";

import "~/styles/tienda-perfil.css";

import { EstiloPlantilla } from "~/app/[slug]/_estilo-plantilla";
import { traerFotografo } from "~/app/[slug]/_datos";
import { Tienda } from "~/app/[slug]/_tienda";
import { esPlantilla } from "~/lib/storefront-templates";
import { resolveMediaUrl } from "~/server/media";

import { direccionDelQueMira } from "./_datos";

/**
 * Tu página con otra plantilla, antes de cambiarla.
 *
 * La usa el diálogo de plantillas del panel (en un iframe): cada opción se
 * muestra armada con la página de verdad —tu logo, tus eventos, tu color— y
 * no con una maqueta, porque una maqueta se desincroniza en cuanto la página
 * cambia y termina mintiendo justo donde más confianza hace falta.
 *
 *   /vista-tienda/dark                       tu página con la plantilla "dark"
 *   /vista-tienda/cancha?color=…&color2=…    la misma, con los colores que probás
 *
 * Es la MISMA página que /[slug] (ver _tienda.tsx), con la plantilla pasada
 * por parámetro en vez de leída de la base. Sólo la ve el dueño, con su
 * sesión; para cualquier otro la ruta no existe. Igual que /vista-portfolio,
 * no va en /dashboard porque ahí todo va adentro del riel, y lo que se quiere
 * ver es la página a ancho completo, como la ve un visitante.
 */

export const metadata: Metadata = {
  title: "Vista de plantilla",
  robots: { index: false, follow: false },
};

const HEX = /^#[0-9A-Fa-f]{6}$/;

/** Un color de la URL, o nada: lo que no es un hex se ignora, no se dibuja. */
function colorDeUrl(v: string | string[] | undefined): string | null {
  const s = Array.isArray(v) ? v[0] : v;
  return s && HEX.test(s) ? s.toUpperCase() : null;
}

export default async function VistaTienda({
  params,
  searchParams,
}: {
  params: Promise<{ plantilla: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { plantilla } = await params;
  if (!esPlantilla(plantilla)) notFound();

  const slug = await direccionDelQueMira();
  if (!slug) notFound();
  const user = await traerFotografo(slug);
  if (!user) notFound();

  const q = await searchParams;
  const color = colorDeUrl(q.color) ?? user.storefrontBrandColor;
  const color2 = colorDeUrl(q.color2) ?? user.storefrontBrandColor2;

  const logoUrl = user.logoKey ? await resolveMediaUrl(user.logoKey) : null;

  return (
    <>
      {/* El layout ya puso las variables con los colores guardados; estas,
          con los que se están probando, vienen después y ganan. */}
      <EstiloPlantilla plantilla={plantilla} color={color} color2={color2} />
      <Tienda slug={slug} user={user} logoUrl={logoUrl} plantilla={plantilla} color={color} color2={color2} />
    </>
  );
}
