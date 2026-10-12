import { FAMILIAS } from "../familias";
import { DEFAULT_GRID, DEFAULT_LOGO } from "../tipos";
import { FOTOFINISH_NODES, FOTOFINISH_SECTIONS } from "./fotofinish";
import { KILOMETRO_NODES, KILOMETRO_SECTIONS } from "./kilometro";
import { PARCIAL_NODES, PARCIAL_SECTIONS } from "./parcial";
import { PODIO_NODES, PODIO_SECTIONS } from "./podio";
import { SENDERO_NODES, SENDERO_SECTIONS } from "./sendero";
import type { TemplateDef } from "./tipos";

/**
 * Las plantillas de portfolio que existen, hechas para fotografía deportiva
 * (diseño en Paper, archivo «encontrate — Portfolio»).
 *
 * Las tres que vinieron de photo-saas (Halcyon, Meridian, Vernissage) se
 * sacaron: la línea es de letra sans, y ésas no lo eran. Podio se quedó, con
 * Inter Tight en lugar de la mono que tenía para los textos. Un
 * portfolio guardado con una de ellas se dibuja con la plantilla por defecto
 * (ver plantillaValida): no se rompe, cambia de cara.
 *
 * Las fuentes van por variable (ver ../fuentes.ts).
 */
export type IdPlantilla = "fotofinish" | "sendero" | "podio" | "parcial" | "kilometro";

export const PLANTILLAS: Record<IdPlantilla, TemplateDef> = {
  fotofinish: {
    id: "fotofinish",
    name: "Fotofinish",
    descripcion: "Revista suiza: blanco, cobalto y una tira que se recorre.",
    initialNodes: FOTOFINISH_NODES,
    sections: FOTOFINISH_SECTIONS,
    defaultPalette: { bg: "#FFFFFF", fg: "#0B0B0C", accent: "#1F3BFF", muted: "#6B6B70" },
    defaultTypography: { serif: FAMILIAS.instrumentSans, sans: FAMILIAS.instrumentSans, mono: FAMILIAS.instrumentSans },
    defaultLogo: { ...DEFAULT_LOGO, text: "{nombre}" },
    // La tira y la serie destacada son el diseño: no hay grilla que elegir.
    layouts: [],
  },
  sendero: {
    id: "sendero",
    name: "Sendero",
    descripcion: "Crónica de montaña: arcos, hueso y verde verdín.",
    initialNodes: SENDERO_NODES,
    sections: SENDERO_SECTIONS,
    defaultPalette: { bg: "#EEEBE3", fg: "#1E1F1C", accent: "#3F7F6E", muted: "#77786F" },
    defaultTypography: { serif: FAMILIAS.fraunces, sans: FAMILIAS.interTight, mono: FAMILIAS.interTight },
    defaultButtons: { radius: 100, bg: "", fg: "" },
    defaultLogo: { ...DEFAULT_LOGO, text: "{nombre}" },
    // Las crónicas en abanico son el diseño: no hay grilla que elegir.
    layouts: [],
  },
  podio: {
    id: "podio",
    name: "Podio",
    descripcion: "Cartelería de estadio: negro, amarillo y cifras de tablero.",
    initialNodes: PODIO_NODES,
    sections: PODIO_SECTIONS,
    defaultPalette: { bg: "#0A0A0A", fg: "#F2F2F2", accent: "#FFD400", muted: "#8A8A8A" },
    defaultTypography: { serif: FAMILIAS.anton, sans: FAMILIAS.interTight, mono: FAMILIAS.interTight },
    defaultLogo: { ...DEFAULT_LOGO, text: "{nombre}" },
    defaultGrid: { ...DEFAULT_GRID, layout: "mosaic", columns: 3, gap: 16 },
    layouts: ["mosaic", "uniform", "masonry"],
  },
  parcial: {
    id: "parcial",
    name: "Parcial",
    descripcion: "Planilla de cronometraje: casi blanco, naranja señal y Geist.",
    initialNodes: PARCIAL_NODES,
    sections: PARCIAL_SECTIONS,
    defaultPalette: { bg: "#F4F4F1", fg: "#121212", accent: "#FF4F1F", muted: "#7A7A75" },
    defaultTypography: { serif: FAMILIAS.geist, sans: FAMILIAS.geist, mono: FAMILIAS.geistMono },
    defaultLogo: { ...DEFAULT_LOGO, text: "{nombre}" },
    // La grilla pareja con su pie de foto es el diseño: no hay grilla que elegir.
    layouts: [],
  },
  kilometro: {
    id: "kilometro",
    name: "Kilómetro",
    descripcion: "Revista outdoor: arena, terracota y carruseles por evento.",
    initialNodes: KILOMETRO_NODES,
    sections: KILOMETRO_SECTIONS,
    defaultPalette: { bg: "#EFE9DF", fg: "#1C1B19", accent: "#C2532D", muted: "#857C70" },
    defaultTypography: { serif: FAMILIAS.manrope, sans: FAMILIAS.manrope, mono: FAMILIAS.manrope },
    defaultButtons: { radius: 100, bg: "", fg: "" },
    defaultLogo: { ...DEFAULT_LOGO, text: "{nombre}" },
    // Los carruseles por evento son el diseño: no hay grilla que elegir.
    layouts: [],
  },
};

export const PLANTILLA_POR_DEFECTO: IdPlantilla = "fotofinish";

export function esPlantilla(id: string): id is IdPlantilla {
  return Object.hasOwn(PLANTILLAS, id);
}

/** La plantilla de un diseño guardado, o la por defecto si ya no existe. */
export function plantillaValida(id: string | null | undefined): IdPlantilla {
  return id && esPlantilla(id) ? id : PLANTILLA_POR_DEFECTO;
}
