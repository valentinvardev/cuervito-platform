import { notFound } from "next/navigation";

import { CabezaTienda } from "~/app/[slug]/_cabeza";
import { traerFotografo } from "~/app/[slug]/_datos";
import { esPlantilla } from "~/lib/storefront-templates";

import { direccionDelQueMira } from "./_datos";

/**
 * El mismo armazón que el de la tienda pública, con la plantilla que pide la
 * URL en vez de la guardada. Sin registro de visitas: el que mira es el dueño
 * eligiendo, no un atleta llegando.
 */
export default async function LayoutVistaTienda({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ plantilla: string }>;
}) {
  const { plantilla } = await params;
  if (!esPlantilla(plantilla)) notFound();

  const slug = await direccionDelQueMira();
  const user = slug ? await traerFotografo(slug) : null;
  if (!user) notFound();

  return (
    <>
      <CabezaTienda
        plantilla={plantilla}
        color={user.storefrontBrandColor}
        color2={user.storefrontBrandColor2}
        conVisitas={false}
      />
      {children}
    </>
  );
}
