import "~/styles/v2/tokens.css";
import "~/styles/v2/base.css";
import "~/styles/v2/panel.css";
import "~/styles/v2/dashboard.css";
import "~/styles/v2/paginas.css";

import { Shell } from "./_components/shell";
import { sesionV2 } from "./_components/sesion";

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
  const { nombre, slug, iniciales } = await sesionV2();

  // Las variables se pisan en un envoltorio y no en :root: las propiedades
  // personalizadas se heredan, así que todo lo de adentro las toma y lo de
  // afuera de /v2 queda intacto. --fuente-display y --fuente-sans las define
  // el layout raíz sobre el <html>; acá sólo se dice qué rol cumple cada una.
  return (
    <div
      style={
        {
          "--display": "var(--fuente-display), system-ui, sans-serif",
          "--sans": "var(--fuente-sans), system-ui, sans-serif",
          "--meta": "var(--fuente-sans), system-ui, sans-serif",
        } as React.CSSProperties
      }
    >
      <Shell nombre={nombre} slug={slug} iniciales={iniciales}>
        {children}
      </Shell>
    </div>
  );
}
