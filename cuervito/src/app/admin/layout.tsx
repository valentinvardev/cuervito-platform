/* El armazón del panel, entero: tokens, base, riel y pantallas. */
import "~/styles/v2/tokens.css";
import "~/styles/v2/base.css";
import "~/styles/v2/panel.css";
import "~/styles/v2/dashboard.css";
import "~/styles/v2/paginas.css";

/* Las hojas del prototipo, ENVUELTAS en .adm (ver scripts/envolver-admin-css).
   Van después del armazón a propósito: adentro del contenedor mandan ellas,
   afuera no existen. Y encima, la capa que mapea sus variables sobre los
   tokens de encontrate, que sólo funciona si llega al final. */
import "~/styles/v2/admin-cuerpo.css";
import "~/styles/v2/admin.css";

import { redirect } from "next/navigation";

import { TooltipProvider } from "~/app/_components/tooltip-provider";

import { Shell } from "~/app/dashboard/_components/shell";
import { sesionPanel } from "~/app/dashboard/_components/sesion";

/**
 * El panel de administración, con el mismo armazón que el del fotógrafo.
 *
 * Tenía el suyo: una barra arriba con la marca al centro y una fila de
 * pestañas debajo, heredadas del prototipo de cuervito. Con el rebrand se le
 * habían mapeado los colores y las fuentes, pero seguía siendo otro lugar:
 * otra estructura, otro ritmo, otra manera de moverse. Ahora es el riel de
 * siempre con otra lista de destinos, y la marca, el buscador, el tema y el
 * aviso de ventas en vivo son los mismos componentes.
 *
 * Las páginas de adentro no se reescribieron: siguen con las clases del
 * prototipo. Por eso el contenido va adentro de `.adm`, que es hasta donde
 * llega ese CSS.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // sesionPanel ya hace el auth() y la consulta del usuario; repetir auth()
  // acá sería un viaje más a la base en cada pantalla, y en serie.
  const { rol, nombre, slug, iniciales } = await sesionPanel();
  if (rol !== "ADMIN") redirect("/dashboard");

  return (
    <div style={{ "--meta": "var(--sans)" } as React.CSSProperties}>
      {/* Los íconos del prototipo. Las páginas del admin los usan por clase
          (ti ti-…) y reescribirlas todas a lucide es otro trabajo. */}
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.5.0/dist/tabler-icons.min.css"
      />

      <Shell modo="admin" esAdmin nombre={nombre} slug={slug} iniciales={iniciales}>
        <main className="canvas">
          <div className="canvas-in adm">{children}</div>
        </main>
      </Shell>
      <TooltipProvider />
    </div>
  );
}
