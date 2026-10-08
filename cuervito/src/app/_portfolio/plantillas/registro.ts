import { FAMILIAS } from "../familias";
import { DEFAULT_GRID, DEFAULT_LOGO } from "../tipos";
import { HALCYON_NODES, HALCYON_SECTIONS } from "./halcyon";
import { MERIDIAN_NODES, MERIDIAN_SECTIONS } from "./meridian";
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
 */
export type IdPlantilla = "halcyon" | "meridian" | "vernissage";

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
};

export const PLANTILLA_POR_DEFECTO: IdPlantilla = "halcyon";

export function esPlantilla(id: string): id is IdPlantilla {
  return Object.hasOwn(PLANTILLAS, id);
}
