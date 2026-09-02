import "~/styles/v2/tokens.css";
import "~/styles/v2/base.css";
import "~/styles/v2/panel.css";
import "~/styles/v2/dashboard.css";
import "~/styles/v2/paginas.css";

import { TooltipProvider } from "~/app/_components/tooltip-provider";

import { puedeUsarHistorias } from "~/server/historias/acceso";

import { Shell } from "./_components/shell";
import { sesionPanel } from "./_components/sesion";

/**
 * Vista previa del panel rediseñado. Sólo para admins.
 *
 * El armazón (riel y barra) se monta ACÁ y no en cada página. Cuando estaba en
 * la página, cada navegación lo desmontaba y lo volvía a construir: el riel
 * parpadeaba en cada click y de ahí salía la sensación de lentitud. Desde el
 * layout, React lo mantiene montado entre rutas y sólo cambia el contenido,
 * que además es lo que permite que loading.tsx muestre el esqueleto adentro
 * del armazón en vez de reemplazar la pantalla entera.
 */
export default async function V2Layout({ children }: { children: React.ReactNode }) {
  const { userId, rol, nombre, slug, iniciales } = await sesionPanel();
  // El riel se arma con lo que el usuario puede abrir: así el ítem no aparece
  // para quien al entrar se comería un 404.
  //
  // Con el rol que sesionPanel ya trajo, y NO con otro auth(). Con auth() esto
  // costaba una consulta más a Supabase en todas las pantallas del panel, y en
  // serie: primero terminaba sesionPanel y recién ahí salía la segunda.
  const historias = await puedeUsarHistorias({ id: userId, role: rol });

  // Las tipografías NO se declaran acá: las decide tokens.css, que apunta a las
  // variables de next/font con el nombre literal como respaldo. Estaban
  // repetidas en los cuatro layouts que cargan los tokens, y el panel de
  // administración —que se sumó después— se olvidó de copiarlas y estuvo
  // renderizando en la fuente del sistema. Con una sola fuente de verdad, el
  // que venga después no tiene de qué acordarse.
  //
  // El envoltorio se queda porque --meta sí es una decisión de esta pantalla.
  return (
    <div
      style={
        {
          "--meta": "var(--sans)",
        } as React.CSSProperties
      }
    >
      <Shell historias={historias} nombre={nombre} slug={slug} iniciales={iniciales}>
        {children}
      </Shell>
      {/* Escucha data-tip en todo el árbol y pinta el globito con un portal a
          <body>. Es el mismo provider del panel actual: el comportamiento
          —retardo, volteo cuando no entra, lados— ya estaba resuelto y sólo
          hacía falta vestirlo con los tokens de acá. */}
      <TooltipProvider />
    </div>
  );
}
