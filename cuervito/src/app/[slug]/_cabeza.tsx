import "~/styles/prototype/styles.css";
import "~/styles/prototype/panel-anim.css";
import "~/styles/prototype/public-event.css";
import "~/styles/prototype/lightbox.css";
// La plantilla nueva. Va con el layout y no con la página porque el <html> de
// la tienda lo arma el layout, y las clases .et- las usa también el carrito,
// que se monta por fuera del árbol de la grilla.
import "~/styles/tienda-encontrate.css";
// Las cinco plantillas con tema: la misma página de encontrate con otra piel,
// activada por el atributo data-plantilla.
import "~/styles/tienda-temas.css";

import { Suspense } from "react";

import { ExternalStylesheets } from "~/app/_components/external-stylesheets";
import { StorefrontTheme } from "~/app/_components/storefront-theme";
import { VisitorTracker } from "~/app/_components/visitor-tracker";
import { getTemplate } from "~/lib/storefront-templates";
import { SCRIPT_TEMA_TIENDA } from "~/lib/tema-tienda";

import { EstiloPlantilla } from "./_estilo-plantilla";

/**
 * Lo que toda tienda necesita antes de dibujarse: sus hojas de estilo, el tema
 * fijado, los íconos y las variables de la plantilla.
 *
 * Lo comparten el layout público (/[slug]) y el de la previa del panel
 * (/vista-tienda), que dibuja la misma página con otra plantilla. Está en un
 * solo lugar para que la previa no pueda desencontrarse de la página real: si
 * la tienda suma una hoja o cambia cómo fija el tema, la previa lo hereda.
 */
export function CabezaTienda({
  plantilla,
  color,
  color2 = null,
  conVisitas = true,
}: {
  plantilla: string | null;
  color: string | null;
  /** El color secundario, para las plantillas de dos colores. */
  color2?: string | null;
  /** Si registra la visita. En la previa del panel no: el que mira es el dueño. */
  conVisitas?: boolean;
}) {
  const tpl = getTemplate(plantilla);
  // El claro/oscuro que elige el visitante es sólo de la tienda base: las
  // plantillas con tema traen su paleta decidida y no cambian de modo.
  const conModo = tpl.id === "encontrate";
  const tema = tpl.tema ? tpl.id : null;

  /* El storefront va siempre en oscuro: es la página de marca del fotógrafo y
     debe verse igual para todo comprador. El script cubre la carga inicial
     (sin flash) y StorefrontTheme cubre las navegaciones SPA, restaurando la
     preferencia real al salir. El atributo de la plantilla va en el mismo
     script, por la misma razón: la piel tiene que estar puesta antes de que
     se pinte la primera letra. */
  const script = [
    "document.documentElement.dataset.theme='dark'",
    tema ? `document.documentElement.dataset.plantilla='${tema}'` : null,
    conModo ? SCRIPT_TEMA_TIENDA : null,
  ]
    .filter(Boolean)
    .join(";");

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: script }} />
      <StorefrontTheme encontrate={conModo} plantilla={tema} />
      {conVisitas && (
        <Suspense fallback={null}>
          <VisitorTracker />
        </Suspense>
      )}
      <ExternalStylesheets />
      <EstiloPlantilla plantilla={plantilla} color={color} color2={color2} />
    </>
  );
}
