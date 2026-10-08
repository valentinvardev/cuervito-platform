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

/** Una foto del sitio. `id` es el de Photo: lo usan las imágenes del diseño
 *  (portada, retrato), que guardan "foto:<id>" y no una URL. */
export type FotoSitio = { id?: string; src: string; title?: string; group?: string; date?: string };

/**
 * La URL de una imagen del diseño.
 *
 * Las imágenes guardan una referencia a la foto ("foto:<id>"), no su URL: la
 * URL depende de quién mira (el dueño ve la miniatura mientras se genera la
 * versión de portfolio) y de dónde se sirve. Guardar la URL era la manera de
 * que la miniatura con marca de la vista previa terminara como portada
 * pública. Si la foto ya no está en el portfolio, cae a la primera.
 */
export function srcDeImagen(src: string | undefined, fotos: FotoSitio[]): string {
  if (!src) return "";
  if (!src.startsWith("foto:")) return src;
  const id = src.slice(5);
  return fotos.find((f) => f.id === id)?.src ?? fotos[0]?.src ?? "";
}

/** Lo del fotógrafo que las plantillas muestran fuera de los textos editables. */
export type PerfilSitio = {
  nombre: string;
  ubicacion: string | null;
  instagram: string | null;
  web: string | null;
  /** Números reales de encontrate, ya formateados ("12 mil"). */
  cifras?: { eventos: string; fotos: string; temporadas: string };
};

/**
 * Los comodines que una plantilla puede usar en sus textos por defecto. Las
 * plantillas de photo-saas traían datos inventados ("Desde 2018", "140
 * eventos", un mail de ejemplo) que un fotógrafo podía publicar sin darse
 * cuenta. Acá salen de su perfil y de encontrate, o no salen.
 */
function comodines(p: PerfilSitio): Record<string, string> {
  const ig = p.instagram?.replace(/^https?:\/\/(www\.)?instagram\.com\//, "@").replace(/\/$/, "") ?? "";
  const web = p.web?.replace(/^https?:\/\//, "").replace(/\/$/, "") ?? "";
  return {
    nombre: p.nombre,
    ubicacion: p.ubicacion ?? "",
    instagram: ig,
    web,
    eventos: p.cifras?.eventos ?? "",
    fotos: p.cifras?.fotos ?? "",
    temporadas: p.cifras?.temporadas ?? "",
  };
}

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
  /** Los nodos que el fotógrafo cambió: son los únicos que se guardan. El
   *  resto sigue a la plantilla (y a {nombre}, que se resuelve al dibujar). */
  tocados: string[];
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
 * fotógrafo: `{nombre}`, `{ubicacion}`, sus cifras, en los textos y en el
 * logo; y las imágenes vacías (portada, retrato) con sus propias fotos, en
 * orden. Así una plantilla recién elegida ya se ve con su nombre y su
 * trabajo, no con un estudio de Lisboa.
 *
 * Un texto que queda vacío (no cargó Instagram, no tiene ubicación) se
 * oculta, y en las filas de contacto se oculta también su rótulo.
 */
function completar(
  d: ReturnType<typeof resolverDiseno>,
  perfil: PerfilSitio,
  fotos: FotoSitio[],
): ReturnType<typeof resolverDiseno> {
  const valores = comodines(perfil);
  let siguiente = 0;
  const nodes: Record<string, EditorNode> = {};
  const vacios: string[] = [];
  for (const [id, n] of Object.entries(d.nodes)) {
    let nodo = n;
    if (nodo.content && /\{\w+\}/.test(nodo.content)) {
      const texto = nodo.content.replace(/\{(\w+)\}/g, (m, k: string) => valores[k] ?? m);
      nodo = { ...nodo, content: texto };
      if (!texto.trim()) vacios.push(id);
    }
    if (nodo.type === "image" && !nodo.src && fotos.length > 0) {
      const f = fotos[siguiente % fotos.length]!;
      nodo = { ...nodo, src: f.id ? `foto:${f.id}` : f.src };
      siguiente++;
    }
    nodes[id] = nodo;
  }
  for (const id of vacios) {
    nodes[id] = { ...nodes[id]!, hidden: true };
    const rotulo = id.replace(/-value$/, "-label");
    if (rotulo !== id && nodes[rotulo]) nodes[rotulo] = { ...nodes[rotulo], hidden: true };
  }
  return { ...d, nodes, logo: { ...d.logo, text: d.logo.text.replaceAll("{nombre}", perfil.nombre) } };
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
    ...completar(resolverDiseno(inicial.diseno), inicial.perfil, inicial.fotos),
    readOnly: inicial.soloLectura,
    galleryPhotos: inicial.fotos,
    perfil: inicial.perfil,
    siteSlug: inicial.slug,
    enviarConsulta: inicial.enviarConsulta ?? null,
    tocados: Object.keys(inicial.diseno.nodes ?? {}),
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
        const nodes = { ...s.nodes, [id]: { ...actual, ...patch } };
        // Un dato que estaba oculto por vacío vuelve a verse al escribirle
        // algo, con su rótulo.
        if (patch.content?.trim() && actual.hidden) {
          nodes[id] = { ...nodes[id]!, hidden: false };
          const rotulo = id.replace(/-value$/, "-label");
          if (rotulo !== id && nodes[rotulo]) nodes[rotulo] = { ...nodes[rotulo], hidden: false };
        }
        return { nodes, tocados: s.tocados.includes(id) ? s.tocados : [...s.tocados, id] };
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
