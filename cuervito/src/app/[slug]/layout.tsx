import { notFound } from "next/navigation";

import { CabezaTienda } from "./_cabeza";
import { traerFotografo } from "./_datos";

export default async function PublicLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  /* El 404 se decide acá, y por eso este layout ya no envuelve a sus hijos en
     un <Suspense>. Con el límite acá arriba, todo lo de abajo —la página de
     la tienda, el layout del evento— corría adentro, y para cuando cualquiera
     llamaba a notFound() el 200 ya había salido: una tienda o un evento que
     no existen respondían 200 con el cartel de «no encontrado», que para
     Google es un soft 404. El esqueleto de carga lo pone ahora cada página
     (la tienda adentro suyo, el evento en su loading.tsx). */
  const user = await traerFotografo(slug);
  if (!user) notFound();

  return (
    <>
      {/* Las hojas de estilo, el tema y las variables de la plantilla viven en
          _cabeza.tsx, compartidas con la previa del panel. */}
      <CabezaTienda
        plantilla={user.storefrontTemplate}
        color={user.storefrontBrandColor}
        color2={user.storefrontBrandColor2}
      />
      {children}
    </>
  );
}
