import { FAMILIAS } from "../familias";
import { DEFAULT_GRID, DEFAULT_LOGO } from "../tipos";
import { FOTOFINISH_NODES, FOTOFINISH_SECTIONS } from "./fotofinish";
import { HALCYON_NODES, HALCYON_SECTIONS } from "./halcyon";
import { MERIDIAN_NODES, MERIDIAN_SECTIONS } from "./meridian";
import { PODIO_NODES, PODIO_SECTIONS } from "./podio";
import { SENDERO_NODES, SENDERO_SECTIONS } from "./sendero";
import type { TemplateDef } from "./tipos";
import { VERNISSAGE_NODES, VERNISSAGE_SECTIONS } from "./vernissage";

/**
 * Las plantillas de portfolio que existen. De las seis de photo-saas se
 * trajeron estas tres: son las más distintas entre sí (oscura editorial,
 * clara de museo, galería nocturna en 3D) y las que mejor le quedan a la
 * fotografía deportiva. Serenata es de casamientos; Minimal BW y Atelier se
 * parecen demasiado a Meridian.
 *
 * Paletas y letras son las de cada plantilla en photo-saas; las fuentes van
 * por variable (ver ../fuentes.ts).
 *
 * Podio, Fotofinish y Sendero son propias, hechas para fotografía deportiva
 * (diseño en Paper, archivo «encontrate — Portfolio», páginas 4 a 6).
 */
export type IdPlantilla = "halcyon" | "meridian" | "vernissage" | "podio" | "fotofinish" | "sendero";

export const PLANTILLAS: Record<IdPlantilla, TemplateDef> = {
  halcyon: {
    id: "halcyon",
    name: "Halcyon",
    descripcion: "Oscura y editorial. Tus eventos como índice.",
    initialNodes: HALCYON_NODES,
    sections: HALCYON_SECTIONS,
    defaultPalette: { bg: "#0E0D0B", fg: "#EFEAE0", accent: "#C2410C", muted: "#8A8378" },
    defaultTypography: { serif: FAMILIAS.instrumentSerif, sans: FAMILIAS.geist, mono: FAMILIAS.geistMono },
    defaultLogo: { ...DEFAULT_LOGO, text: "{nombre}" },
    defaultGrid: { ...DEFAULT_GRID, layout: "index" },
    layouts: ["index", "mosaic", "uniform", "masonry"],
  },
  meridian: {
    id: "meridian",
    name: "Meridian",
    descripcion: "Clara y ordenada, como una muestra de museo.",
    initialNodes: MERIDIAN_NODES,
    sections: MERIDIAN_SECTIONS,
    defaultPalette: { bg: "#F4F2ED", fg: "#16181B", accent: "#2E4E6B", muted: "#8B8E93" },
    defaultTypography: { serif: FAMILIAS.playfair, sans: FAMILIAS.manrope, mono: FAMILIAS.plexMono },
    defaultLogo: { ...DEFAULT_LOGO, text: "{nombre}" },
    defaultGrid: { ...DEFAULT_GRID, layout: "uniform", columns: 3, gap: 14 },
    layouts: ["uniform", "mosaic", "masonry"],
  },
  vernissage: {
    id: "vernissage",
    name: "Vernissage",
    descripcion: "Galería de noche: las fotos pasan en 3D.",
    initialNodes: VERNISSAGE_NODES,
    sections: VERNISSAGE_SECTIONS,
    defaultPalette: { bg: "#14171D", fg: "#EDEBE4", accent: "#C2A15E", muted: "#8A8E96" },
    defaultTypography: { serif: FAMILIAS.fraunces, sans: FAMILIAS.spaceGrotesk, mono: FAMILIAS.spaceMono },
    defaultLogo: { ...DEFAULT_LOGO, text: "{nombre}" },
    defaultGrid: { ...DEFAULT_GRID, layout: "corridor", columns: 3, gap: 12 },
    layouts: ["corridor", "uniform", "masonry"],
  },
  podio: {
    id: "podio",
    name: "Podio",
    descripcion: "Cartelería de estadio: negro, amarillo y cifras de tablero.",
    initialNodes: PODIO_NODES,
    sections: PODIO_SECTIONS,
    defaultPalette: { bg: "#0A0A0A", fg: "#F2F2F2", accent: "#FFD400", muted: "#8A8A8A" },
    defaultTypography: { serif: FAMILIAS.anton, sans: FAMILIAS.jetbrainsMono, mono: FAMILIAS.jetbrainsMono },
    defaultLogo: { ...DEFAULT_LOGO, text: "{nombre}" },
    defaultGrid: { ...DEFAULT_GRID, layout: "mosaic", columns: 3, gap: 16 },
    layouts: ["mosaic", "uniform", "masonry"],
  },
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
};

export const PLANTILLA_POR_DEFECTO: IdPlantilla = "halcyon";

export function esPlantilla(id: string): id is IdPlantilla {
  return Object.hasOwn(PLANTILLAS, id);
}
