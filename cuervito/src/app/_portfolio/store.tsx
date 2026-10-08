"use client";

import { createContext, useContext } from "react";
import { createStore, useStore, type StoreApi } from "zustand";

import { PLANTILLAS, PLANTILLA_POR_DEFECTO, type IdPlantilla } from "./plantillas/registro";
import type {
  ButtonStyle,
  ColorPalette,
  ContactSettings,
  EditorNode,
  EditorState,
  GridSettings,
  LogoSettings,
  Typography,
  Viewport,
} from "./tipos";
import {
  DEFAULT_BUTTONS,
  DEFAULT_CONTACT,
  DEFAULT_GRID,
  DEFAULT_LOGO,
  DEFAULT_PALETTE,
  DEFAULT_TYPOGRAPHY,
} from "./tipos";

/**
 * El estado de UN sitio de portfolio: el diseño, las fotos y, en el editor,
 * qué está seleccionado.
 *
 * En photo-saas era un store global de módulo (`create(...)`). En el
 * navegador da igual, porque hay un solo usuario; en el servidor no: el módulo
 * se carga una vez por proceso y lo comparten todas las requests, así que dos
 * visitas simultáneas a dos portfolios distintos escribirían el mismo store y
 * una podía salir con las fotos de la otra. Acá cada <ProveedorSitio> crea el
 * suyo (`createStore`) y los componentes lo leen por contexto.
 *
 * El hook conserva el nombre y la firma de allá —`useEditorStore()` y
 * `useEditorStore(selector)`— para que las plantillas se porten sin tocarles
 * cada línea.
 */

/** El diseño que se guarda por portfolio. Misma forma que en photo-saas. */
export interface PortfolioDesign {
  templateId?: IdPlantilla;
  nodes?: Record<string, EditorNode>;
  palette?: ColorPalette;
  typography?: Typography;
  buttons?: ButtonStyle;
  grid?: GridSettings;
  logo?: LogoSettings;
  contact?: ContactSettings;
  hiddenSections?: string[];
}

export type FotoSitio = { src: string; title?: string; group?: string; date?: string };

/** Lo del fotógrafo que las plantillas muestran fuera de los textos editables. */
export type PerfilSitio = {
  nombre: string;
  ubicacion: string | null;
  instagram: string | null;
  web: string | null;
};

export type Consulta = { name: string; email: string; message: string };

/** Quien monta el sitio decide adónde va el formulario de contacto. */
export type EnviarConsulta = (c: Consulta) => Promise<void>;

export interface EstadoSitio extends EditorState {
  templateId: IdPlantilla;
  readOnly: boolean;
  galleryPhotos: FotoSitio[];
  perfil: PerfilSitio;
  siteSlug: string | null;
  enviarConsulta: EnviarConsulta | null;
  selectNode: (id: string | null) => void;
  setEditing: (id: string | null) => void;
  updateNode: (id: string, patch: Partial<EditorNode>) => void;
  setPalette: (patch: Partial<ColorPalette>) => void;
  setTypography: (patch: Partial<Typography>) => void;
  setButtons: (patch: Partial<ButtonStyle>) => void;
  setGrid: (patch: Partial<GridSettings>) => void;
  setLogo: (patch: Partial<LogoSettings>) => void;
  setContact: (patch: Partial<ContactSettings>) => void;
  setViewport: (v: Viewport) => void;
  hideSection: (id: string) => void;
  showSection: (id: string) => void;
}

export type StoreSitio = StoreApi<EstadoSitio>;

/** El diseño guardado, completado con los valores de la plantilla. */
function resolverDiseno(d: PortfolioDesign) {
  const templateId = d.templateId && PLANTILLAS[d.templateId] ? d.templateId : PLANTILLA_POR_DEFECTO;
  const tpl = PLANTILLAS[templateId];
  return {
    templateId,
    // Los nodos guardados van encima de los de la plantilla: un diseño viejo,
    // de antes de que la plantilla sumara un texto, toma el texto por
    // defecto en vez de mostrarlo vacío.
    nodes: d.nodes ? { ...tpl.initialNodes, ...d.nodes } : tpl.initialNodes,
    palette: d.palette ?? tpl.defaultPalette ?? DEFAULT_PALETTE,
    typography: d.typography ?? tpl.defaultTypography ?? DEFAULT_TYPOGRAPHY,
    buttons: d.buttons ? { ...DEFAULT_BUTTONS, ...d.buttons } : (tpl.defaultButtons ?? DEFAULT_BUTTONS),
    grid: d.grid ? { ...DEFAULT_GRID, ...d.grid } : (tpl.defaultGrid ?? DEFAULT_GRID),
    logo: d.logo ?? tpl.defaultLogo ?? DEFAULT_LOGO,
    contact: d.contact ? { ...DEFAULT_CONTACT, ...d.contact } : DEFAULT_CONTACT,
    hiddenSections: d.hiddenSections ?? [],
  };
}

/**
 * Lo que la plantilla trae como comodín, resuelto con los datos del
 * fotógrafo: `{nombre}` en los textos y en el logo, y las imágenes vacías
 * (portada, retrato) con sus propias fotos, en orden. Así una plantilla recién
 * elegida ya se ve con su nombre y su trabajo, no con un estudio de Lisboa.
 */
function completar(
  d: ReturnType<typeof resolverDiseno>,
  nombre: string,
  fotos: FotoSitio[],
): ReturnType<typeof resolverDiseno> {
  let siguiente = 0;
  const nodes: Record<string, EditorNode> = {};
  for (const [id, n] of Object.entries(d.nodes)) {
    let nodo = n;
    if (nodo.content?.includes("{nombre}")) {
      nodo = { ...nodo, content: nodo.content.replaceAll("{nombre}", nombre) };
    }
    if (nodo.type === "image" && !nodo.src && fotos.length > 0) {
      nodo = { ...nodo, src: fotos[siguiente % fotos.length]!.src };
      siguiente++;
    }
    nodes[id] = nodo;
  }
  return { ...d, nodes, logo: { ...d.logo, text: d.logo.text.replaceAll("{nombre}", nombre) } };
}

export function crearStoreSitio(inicial: {
  diseno: PortfolioDesign;
  perfil: PerfilSitio;
  fotos: FotoSitio[];
  slug: string | null;
  soloLectura: boolean;
  viewport: Viewport;
  enviarConsulta?: EnviarConsulta;
}): StoreSitio {
  return createStore<EstadoSitio>()((set) => ({
    ...completar(resolverDiseno(inicial.diseno), inicial.perfil.nombre, inicial.fotos),
    readOnly: inicial.soloLectura,
    galleryPhotos: inicial.fotos,
    perfil: inicial.perfil,
    siteSlug: inicial.slug,
    enviarConsulta: inicial.enviarConsulta ?? null,
    selectedId: null,
    editingId: null,
    viewport: inicial.viewport,
    selectedSection: null,
    hoveredSection: null,

    selectNode: (id) => set({ selectedId: id, editingId: null }),
    setEditing: (id) => set({ editingId: id }),
    updateNode: (id, patch) =>
      set((s) => {
        const actual = s.nodes[id];
        if (!actual) return s;
        return { nodes: { ...s.nodes, [id]: { ...actual, ...patch } } };
      }),
    setPalette: (patch) => set((s) => ({ palette: { ...s.palette, ...patch } })),
    setTypography: (patch) => set((s) => ({ typography: { ...s.typography, ...patch } })),
    setButtons: (patch) => set((s) => ({ buttons: { ...s.buttons, ...patch } })),
    setGrid: (patch) => set((s) => ({ grid: { ...s.grid, ...patch } })),
    setLogo: (patch) => set((s) => ({ logo: { ...s.logo, ...patch } })),
    setContact: (patch) => set((s) => ({ contact: { ...s.contact, ...patch } })),
    setViewport: (v) => set({ viewport: v }),
    hideSection: (id) =>
      set((s) => ({ hiddenSections: [...s.hiddenSections.filter((x) => x !== id), id] })),
    showSection: (id) => set((s) => ({ hiddenSections: s.hiddenSections.filter((x) => x !== id) })),
  }));
}

const ContextoSitio = createContext<StoreSitio | null>(null);

export const ProveedorStore = ContextoSitio.Provider;

export function useEditorStore(): EstadoSitio;
export function useEditorStore<T>(selector: (s: EstadoSitio) => T): T;
export function useEditorStore<T>(selector?: (s: EstadoSitio) => T): T | EstadoSitio {
  const store = useContext(ContextoSitio);
  if (!store) throw new Error("useEditorStore fuera de un <ProveedorSitio>");
  return useStore(store, (selector ?? ((s: EstadoSitio) => s)) as (s: EstadoSitio) => T | EstadoSitio);
}
