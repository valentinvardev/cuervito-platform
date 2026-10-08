import "~/styles/prototype/styles.css";
import "~/styles/prototype/panel-anim.css";
import "~/styles/prototype/public-event.css";
import "~/styles/prototype/lightbox.css";
// La plantilla nueva. Va acá y no en la página porque el <html> de la tienda lo
// arma este layout, y las clases .et- las usa también el carrito, que se monta
// por fuera del árbol de la grilla.
import "~/styles/tienda-encontrate.css";

import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ExternalStylesheets } from "~/app/_components/external-stylesheets";
import { StorefrontTheme } from "~/app/_components/storefront-theme";
import { VisitorTracker } from "~/app/_components/visitor-tracker";
import { buildTemplateCSSOverride, getTemplate } from "~/lib/storefront-templates";
import { SCRIPT_TEMA_TIENDA } from "~/lib/tema-tienda";

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

  const cssOverride = buildTemplateCSSOverride(user.storefrontTemplate, user.storefrontBrandColor);
  const encontrate = getTemplate(user.storefrontTemplate).layout === "encontrate";

  return (
    <>
      {/* El storefront va siempre en oscuro: es la página de marca del
         fotógrafo y debe verse igual para todo comprador. El script
         cubre la carga inicial (sin flash) y StorefrontTheme cubre las
         navegaciones SPA, restaurando la preferencia real al salir. */}
      <script
        dangerouslySetInnerHTML={{
          __html: `document.documentElement.dataset.theme='dark'${encontrate ? ";" + SCRIPT_TEMA_TIENDA : ""}`,
        }}
      />
      <StorefrontTheme encontrate={encontrate} />
      <Suspense fallback={null}>
        <VisitorTracker />
      </Suspense>
      <ExternalStylesheets />
      {cssOverride && (
        <style dangerouslySetInnerHTML={{ __html: cssOverride }} />
      )}
      {children}
    </>
  );
}
