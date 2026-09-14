/* El armazón del panel, entero: tokens, base, riel y pantallas. */
import "~/styles/v2/tokens.css";
import "~/styles/v2/base.css";
import "~/styles/v2/panel.css";
import "~/styles/v2/dashboard.css";
import "~/styles/v2/paginas.css";
/* Las columnas de las listas del admin. Es lo único propio. */
import "~/styles/v2/admin-listas.css";

/* Las hojas del prototipo, ENVUELTAS en .adm (ver scripts/envolver-admin-css),
   para las pantallas que todavía no se portaron. Sólo alcanzan a lo que va
   adentro de <Legado>; el resto ni las ve. Y encima, la capa que mapea sus
   variables sobre los tokens de encontrate, que sólo funciona si llega al
   final. */
import "~/styles/v2/admin-cuerpo.css";
import "~/styles/v2/admin.css";

import { redirect } from "next/navigation";

import { TooltipProvider } from "~/app/_components/tooltip-provider";

import { Shell } from "~/app/dashboard/_components/shell";
import { sesionPanel } from "~/app/dashboard/_components/sesion";

/**
 * El panel de administración, con el mismo armazón que el del fotógrafo.
 *
 * Tenía el suyo —barra arriba, pestañas debajo— heredado del prototipo de
 * cuervito. Ahora es el riel de siempre con otra lista de destinos: la marca,
 * el buscador, el tema y el aviso de ventas son los mismos componentes.
 *
 * Cada pantalla trae su propio <main className="canvas">, igual que en el
 * panel. Las que siguen con el CSS viejo lo hacen a través de <Legado>, que es
 * la lista viva de lo que falta portar.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // sesionPanel ya hace el auth() y la consulta del usuario; repetir auth()
  // acá sería un viaje más a la base en cada pantalla, y en serie.
  const { rol, nombre, slug, iniciales } = await sesionPanel();
  if (rol !== "ADMIN") redirect("/dashboard");

  return (
    <div style={{ "--meta": "var(--sans)" } as React.CSSProperties}>
      {/* Los íconos del prototipo, para las pantallas en <Legado>. */}
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.5.0/dist/tabler-icons.min.css"
      />

      <Shell modo="admin" esAdmin nombre={nombre} slug={slug} iniciales={iniciales}>
        {children}
      </Shell>
      <TooltipProvider />
    </div>
  );
}
