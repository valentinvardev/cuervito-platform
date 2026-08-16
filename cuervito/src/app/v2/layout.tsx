import "~/styles/v2/tokens.css";
import "~/styles/v2/base.css";
import "~/styles/v2/panel.css";
import "~/styles/v2/dashboard.css";
import "~/styles/v2/paginas.css";

import { Outfit, Unbounded } from "next/font/google";

import { Shell } from "./_components/shell";
import { sesionV2 } from "./_components/sesion";

/**
 * Las fuentes van por next/font y no por un <link> a Google Fonts.
 *
 * El <link rel="stylesheet"> dentro del JSX de un layout no lo iza React 19 al
 * head salvo que lleve `precedence`, así que la hoja quedaba en el cuerpo y
 * Unbounded no llegaba a aplicarse: los títulos salían con la tipografía de
 * sistema. Además next/font las auto-hospeda, con lo que se va una petición
 * bloqueante a un tercero.
 */
const display = Unbounded({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
  variable: "--fuente-display",
  display: "swap",
});

const sans = Outfit({
  subsets: ["latin"],
  weight: ["200", "300", "400", "500", "600"],
  variable: "--fuente-sans",
  display: "swap",
});

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
  // afuera de /v2 queda intacto.
  return (
    <div
      className={`${display.variable} ${sans.variable}`}
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
