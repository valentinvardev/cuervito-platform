"use client";

import { useEffect, useState } from "react";
import { useStore } from "zustand";

import { COMPONENTES } from "./plantillas/componentes";
import {
  crearStoreSitio,
  ProveedorStore,
  type EnviarConsulta,
  type FotoSitio,
  type PerfilSitio,
  type PortfolioDesign,
  type StoreSitio,
} from "./store";
import type { Viewport } from "./tipos";

function viewportDeAncho(ancho: number): Viewport {
  return ancho < 640 ? "mobile" : ancho < 1024 ? "tablet" : "desktop";
}

/**
 * Un portfolio dibujado, listo para el sitio público o para una vista previa.
 *
 * Crea su store una sola vez (useState con inicializador): las props de la
 * primera vuelta son el estado inicial, igual que un formulario no
 * controlado.
 *
 * LO RESPONSIVE. Meridian y Vernissage no usan media queries: arman el layout
 * según `viewport`, que en el editor sale del selector de dispositivo. En el
 * sitio sale del ancho de la ventana, y el servidor no lo conoce. Por eso la
 * página le pasa una primera suposición sacada del User-Agent (celular o
 * no), y después de montar se corrige con el ancho real. Si la suposición
 * acierta —casi siempre— no hay salto; si no, hay uno solo al cargar.
 */
export function SitioPortfolio({
  diseno,
  perfil,
  fotos,
  slug,
  viewportInicial,
  enviarConsulta,
}: {
  diseno: PortfolioDesign;
  perfil: PerfilSitio;
  fotos: FotoSitio[];
  slug: string | null;
  viewportInicial: Viewport;
  enviarConsulta?: EnviarConsulta;
}) {
  const [store] = useState<StoreSitio>(() =>
    crearStoreSitio({ diseno, perfil, fotos, slug, soloLectura: true, viewport: viewportInicial, enviarConsulta }),
  );

  useEffect(() => {
    const ajustar = () => store.getState().setViewport(viewportDeAncho(window.innerWidth));
    ajustar();
    window.addEventListener("resize", ajustar);
    return () => window.removeEventListener("resize", ajustar);
  }, [store]);

  return (
    <ProveedorStore value={store}>
      <Lienzo store={store} />
    </ProveedorStore>
  );
}

/** La plantilla con las variables de diseño (--ed-*, --tpl-*) que lee. */
export function Lienzo({ store }: { store: StoreSitio }) {
  const templateId = useStore(store, (s) => s.templateId);
  const viewport = useStore(store, (s) => s.viewport);
  const palette = useStore(store, (s) => s.palette);
  const typography = useStore(store, (s) => s.typography);
  const buttons = useStore(store, (s) => s.buttons);
  const hiddenSections = useStore(store, (s) => s.hiddenSections);
  const Plantilla = COMPONENTES[templateId];

  const variables = {
    "--ed-bg": palette.bg,
    "--ed-fg": palette.fg,
    "--ed-accent": palette.accent,
    "--ed-muted": palette.muted,
    "--tpl-serif": typography.serif,
    "--tpl-sans": typography.sans,
    "--tpl-mono": typography.mono,
    "--ed-btn-radius": `${buttons.radius}px`,
    "--ed-btn-bg": buttons.bg || "var(--ed-fg)",
    "--ed-btn-fg": buttons.fg || "var(--ed-bg)",
  } as React.CSSProperties;

  return (
    <div className="pf-sitio" style={{ ...variables, minHeight: "100dvh", background: palette.bg }}>
      {/* Los ids son los de las secciones de la plantilla. Igual se filtran:
          esto termina dentro de un <style>, y CSS.escape no existe en el
          servidor. */}
      {hiddenSections.length > 0 && (
        <style>
          {hiddenSections
            .filter((id) => /^[\w-]+$/.test(id))
            .map((id) => `.pf-sitio #${id}{display:none!important}`)
            .join("\n")}
        </style>
      )}
      <Plantilla viewport={viewport} />
    </div>
  );
}
