import "~/styles/v2/tokens.css";
import "~/styles/v2/base.css";
import "~/styles/v2/panel.css";
import "~/styles/v2/dashboard.css";
import "~/styles/v2/paginas.css";

import { TooltipProvider } from "~/app/_components/tooltip-provider";

import { Shell } from "~/app/dashboard/_components/shell";
import { sesionPanel } from "~/app/dashboard/_components/sesion";

/**
 * El armazón del panel, alrededor de la demo de subida.
 *
 * Es el mismo trabajo que hace /v2/layout.tsx: el riel, la barra de arriba, los
 * cinco archivos de CSS y el globito de ayuda. Se repite acá en vez de meter la
 * demo adentro de /v2 porque la dirección tiene que quedar corta —/demo/subida—
 * para poder tipearla en el teléfono sin errores en medio de una grabación.
 *
 * Y es un layout aparte, y no el de /demo, porque el CSS del panel son cien
 * kilobytes que la demo de la compra no usa para nada.
 */
export default async function DemoSubidaLayout({ children }: { children: React.ReactNode }) {
  const { nombre, slug, iniciales } = await sesionPanel();

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
      <TooltipProvider />
    </div>
  );
}
