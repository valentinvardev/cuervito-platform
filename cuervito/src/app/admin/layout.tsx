/* El armazón del panel, entero: tokens, base, riel y pantallas. */
import "~/styles/v2/tokens.css";
import "~/styles/v2/base.css";
import "~/styles/v2/panel.css";
import "~/styles/v2/dashboard.css";
import "~/styles/v2/paginas.css";
/* Las columnas de las listas del admin y el editor de la marca de agua. Es
   lo único propio. */
import "~/styles/v2/admin-listas.css";
import "~/styles/v2/admin-marca.css";
/* La bandeja del chat de soporte y los avisos de mensaje nuevo. */
import "~/styles/v2/chat.css";

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
import { perfilDelRiel, sesionPanel } from "~/app/dashboard/_components/sesion";
import { conversacionesPendientes } from "~/server/chat";

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
  const sesion = await sesionPanel();
  const { rol, nombre, slug, iniciales } = sesion;
  if (rol !== "ADMIN") redirect("/dashboard");
  // El número del riel (conversaciones con algo sin leer) sale con cada
  // pantalla, en paralelo con el perfil: una consulta chica sobre Conversacion.
  const [perfil, chatPendientes] = await Promise.all([perfilDelRiel(sesion), conversacionesPendientes()]);

  return (
    <div style={{ "--meta": "var(--sans)" } as React.CSSProperties}>
      {/* Los íconos del prototipo, para las pantallas en <Legado>. */}
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.5.0/dist/tabler-icons.min.css"
      />

      <Shell
        modo="admin"
        esAdmin
        chatPendientes={chatPendientes}
        nombre={nombre}
        slug={slug}
        iniciales={iniciales}
        perfil={perfil}
      >
        {children}
      </Shell>
      <TooltipProvider />
    </div>
  );
}
