/**
 * Shared types for the admin photo editor (Level 1 — single canvas, overlay
 * layers). Layers are persisted as a single Json blob on EditorProject; this
 * file is the single source of truth for that shape.
 */

export type LayerBase = {
  id: string;
  x: number;
  y: number;
  rotation: number;
  opacity: number;
  visible: boolean;
  locked: boolean;
};

export type TextLayer = LayerBase & {
  type: "text";
  text: string;
  fontFamily: string; // CSS font-family value, e.g. "'Inter', sans-serif"
  fontSize: number;
  fontWeight: 300 | 400 | 500 | 600 | 700 | 800 | 900;
  italic: boolean;
  align: "left" | "center" | "right";
  color: string;
  width: number; // text box width — wraps within
  letterSpacing: number;
  lineHeight: number;
};

export type RectLayer = LayerBase & {
  type: "rect";
  width: number;
  height: number;
  fill: string;
  stroke: string | null;
  strokeWidth: number;
  cornerRadius: number;
};

export type EllipseLayer = LayerBase & {
  type: "ellipse";
  radiusX: number;
  radiusY: number;
  fill: string;
  stroke: string | null;
  strokeWidth: number;
};

export type ImageLayer = LayerBase & {
  type: "image";
  /** S3 key for this layer's bitmap. */
  sourceKey: string;
  /** Cached CF URL — populated by the page server-side, transient. */
  url?: string;
  width: number;
  height: number;
};

export type Layer = TextLayer | RectLayer | EllipseLayer | ImageLayer;

/** Filters applied to the source/background photo. All optional, 0 / false = off. */
export type SourceFilters = {
  brightness: number; // -1..1
  contrast: number; // -100..100
  saturation: number; // -2..10  (HSV.saturation; 0 = no change)
  hue: number; // -180..180
  blur: number; // 0..40 (px on canvas-space)
  grayscale: boolean;
  sepia: boolean;
  invert: boolean;
};

export function emptyFilters(): SourceFilters {
  return {
    brightness: 0,
    contrast: 0,
    saturation: 0,
    hue: 0,
    blur: 0,
    grayscale: false,
    sepia: false,
    invert: false,
  };
}

export type EditorDoc = {
  width: number;
  height: number;
  /** S3 key of the source/background photo, null = blank canvas. */
  sourceKey: string | null;
  /** Bottom-to-top render order. layers[0] = furthest back. */
  layers: Layer[];
  filters: SourceFilters;
};

export function emptyDoc(width = 1080, height = 1080): EditorDoc {
  return { width, height, sourceKey: null, layers: [], filters: emptyFilters() };
}

// ─── Font catalog ────────────────────────────────────────────────────────────
export type FontDef = {
  /** Display name in the picker. */
  family: string;
  /** Full CSS font-family value to write into the layer. */
  cssFamily: string;
  /** Weights available from Google Fonts for this family. */
  weights: (300 | 400 | 500 | 600 | 700 | 800 | 900)[];
  /** Whether italic variants exist. */
  italics: boolean;
  category: "sans" | "serif" | "display" | "mono" | "handwritten";
  /** Google Fonts URL spec (without `family=` prefix). */
  gfQuery: string;
};

export const FONTS: readonly FontDef[] = [
  {
    family: "Inter",
    cssFamily: "'Inter', system-ui, sans-serif",
    weights: [300, 400, 500, 600, 700, 800, 900],
    italics: true,
    category: "sans",
    gfQuery: "Inter:ital,wght@0,300..900;1,300..900",
  },
  {
    family: "Bricolage Grotesque",
    cssFamily: "'Bricolage Grotesque', sans-serif",
    weights: [400, 600, 700, 800],
    italics: false,
    category: "display",
    gfQuery: "Bricolage+Grotesque:wght@400;600;700;800",
  },
  {
    family: "DM Sans",
    cssFamily: "'DM Sans', sans-serif",
    weights: [400, 500, 700],
    italics: true,
    category: "sans",
    gfQuery: "DM+Sans:ital,wght@0,400;0,500;0,700;1,400;1,500;1,700",
  },
  {
    family: "Playfair Display",
    cssFamily: "'Playfair Display', serif",
    weights: [400, 500, 700, 800, 900],
    italics: true,
    category: "serif",
    gfQuery: "Playfair+Display:ital,wght@0,400;0,500;0,700;0,800;0,900;1,400;1,700",
  },
  {
    family: "Bebas Neue",
    cssFamily: "'Bebas Neue', sans-serif",
    weights: [400],
    italics: false,
    category: "display",
    gfQuery: "Bebas+Neue",
  },
  {
    family: "Anton",
    cssFamily: "'Anton', sans-serif",
    weights: [400],
    italics: false,
    category: "display",
    gfQuery: "Anton",
  },
  {
    family: "Archivo Black",
    cssFamily: "'Archivo Black', sans-serif",
    weights: [900],
    italics: false,
    category: "display",
    gfQuery: "Archivo+Black",
  },
  {
    family: "Space Grotesk",
    cssFamily: "'Space Grotesk', sans-serif",
    weights: [300, 400, 500, 600, 700],
    italics: false,
    category: "sans",
    gfQuery: "Space+Grotesk:wght@300;400;500;600;700",
  },
  {
    family: "Oswald",
    cssFamily: "'Oswald', sans-serif",
    weights: [300, 400, 500, 600, 700],
    italics: false,
    category: "sans",
    gfQuery: "Oswald:wght@300;400;500;600;700",
  },
  {
    family: "Montserrat",
    cssFamily: "'Montserrat', sans-serif",
    weights: [300, 400, 500, 600, 700, 800, 900],
    italics: true,
    category: "sans",
    gfQuery: "Montserrat:ital,wght@0,300..900;1,300..900",
  },
  {
    family: "Roboto Slab",
    cssFamily: "'Roboto Slab', serif",
    weights: [300, 400, 500, 700, 900],
    italics: false,
    category: "serif",
    gfQuery: "Roboto+Slab:wght@300;400;500;700;900",
  },
  {
    family: "Caveat",
    cssFamily: "'Caveat', cursive",
    weights: [400, 600, 700],
    italics: false,
    category: "handwritten",
    gfQuery: "Caveat:wght@400;600;700",
  },
  {
    family: "Permanent Marker",
    cssFamily: "'Permanent Marker', cursive",
    weights: [400],
    italics: false,
    category: "handwritten",
    gfQuery: "Permanent+Marker",
  },
  {
    family: "JetBrains Mono",
    cssFamily: "'JetBrains Mono', monospace",
    weights: [400, 500, 600, 700],
    italics: true,
    category: "mono",
    gfQuery: "JetBrains+Mono:ital,wght@0,400;0,500;0,600;0,700;1,400",
  },
] as const;

/** Find a font by its display family name. */
export function getFont(family: string): FontDef | null {
  return FONTS.find((f) => f.family === family || f.cssFamily === family) ?? null;
}

/** Build the Google Fonts CSS URL covering every family in the catalog. */
export function buildGoogleFontsHref(): string {
  const qs = FONTS.map((f) => `family=${f.gfQuery}`).join("&");
  return `https://fonts.googleapis.com/css2?${qs}&display=swap`;
}

// ─── Layer factories ────────────────────────────────────────────────────────
export function makeTextLayer(canvasW: number, canvasH: number): TextLayer {
  return {
    id: cryptoRandomId(),
    type: "text",
    text: "Texto",
    x: canvasW / 2,
    y: canvasH / 2,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    fontFamily: "'Inter', system-ui, sans-serif",
    fontSize: 64,
    fontWeight: 700,
    italic: false,
    align: "center",
    color: "#ffffff",
    width: Math.round(canvasW * 0.6),
    letterSpacing: 0,
    lineHeight: 1.2,
  };
}

export function makeRectLayer(canvasW: number, canvasH: number): RectLayer {
  const w = Math.round(canvasW * 0.3);
  const h = Math.round(canvasH * 0.15);
  return {
    id: cryptoRandomId(),
    type: "rect",
    x: canvasW / 2 - w / 2,
    y: canvasH / 2 - h / 2,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    width: w,
    height: h,
    fill: "#F5820A",
    stroke: null,
    strokeWidth: 0,
    cornerRadius: 12,
  };
}

export function makeEllipseLayer(canvasW: number, canvasH: number): EllipseLayer {
  const r = Math.round(Math.min(canvasW, canvasH) * 0.1);
  return {
    id: cryptoRandomId(),
    type: "ellipse",
    x: canvasW / 2,
    y: canvasH / 2,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    radiusX: r,
    radiusY: r,
    fill: "#F5820A",
    stroke: null,
    strokeWidth: 0,
  };
}

export function makeImageLayer(
  canvasW: number,
  canvasH: number,
  sourceKey: string,
  url: string,
  imgW: number,
  imgH: number,
): ImageLayer {
  // Fit the image into ~50% of the canvas's shorter side.
  const target = Math.round(Math.min(canvasW, canvasH) * 0.5);
  const scale = target / Math.max(imgW, imgH);
  const w = Math.round(imgW * scale);
  const h = Math.round(imgH * scale);
  return {
    id: cryptoRandomId(),
    type: "image",
    x: canvasW / 2,
    y: canvasH / 2,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    sourceKey,
    url,
    width: w,
    height: h,
  };
}

/** Duplicate a layer with a new id and a small offset. */
export function duplicateLayer(layer: Layer): Layer {
  return {
    ...layer,
    id: cryptoRandomId(),
    x: layer.x + 30,
    y: layer.y + 30,
  };
}

function cryptoRandomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 12);
}

export function layerLabel(layer: Layer): string {
  if (layer.type === "text") return `T  ${layer.text.slice(0, 24) || "Texto"}`;
  if (layer.type === "rect") return "Rectángulo";
  if (layer.type === "ellipse") return "Elipse";
  return "Imagen";
}

/** Deserialize the JSON layers blob from the DB back to typed shape. */
export function parseLayers(raw: unknown): Layer[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((l): l is Layer => {
    if (!l || typeof l !== "object") return false;
    const t = (l as { type?: unknown }).type;
    return t === "text" || t === "rect" || t === "ellipse" || t === "image";
  });
}

// ─── Filter presets ─────────────────────────────────────────────────────────
export type FilterPreset = {
  id: string;
  name: string;
  filters: SourceFilters;
};

/** Curated Instagram-style filter presets. "Original" sits first as the
 *  no-op reset button; the rest mix the underlying knobs to taste. */
export const FILTER_PRESETS: readonly FilterPreset[] = [
  { id: "original", name: "Original", filters: emptyFilters() },
  {
    id: "warm",
    name: "Cálido",
    filters: { ...emptyFilters(), brightness: 0.05, saturation: 0.3, hue: -12 },
  },
  {
    id: "cool",
    name: "Frío",
    filters: { ...emptyFilters(), brightness: -0.04, saturation: 0.15, hue: 20 },
  },
  {
    id: "drama",
    name: "Drama",
    filters: { ...emptyFilters(), contrast: 35, saturation: 0.5 },
  },
  {
    id: "soft",
    name: "Suave",
    filters: { ...emptyFilters(), brightness: 0.08, contrast: -15, saturation: -0.1 },
  },
  {
    id: "punch",
    name: "Punch",
    filters: { ...emptyFilters(), contrast: 22, saturation: 1.2 },
  },
  {
    id: "fade",
    name: "Desvanecido",
    filters: { ...emptyFilters(), brightness: 0.1, contrast: -25, saturation: -0.3 },
  },
  {
    id: "vintage",
    name: "Vintage",
    filters: {
      ...emptyFilters(),
      brightness: 0.04,
      contrast: -10,
      saturation: -0.4,
      sepia: true,
    },
  },
  {
    id: "noir",
    name: "Noir",
    filters: { ...emptyFilters(), brightness: -0.08, contrast: 40, grayscale: true },
  },
  {
    id: "bw",
    name: "B/N alto contraste",
    filters: { ...emptyFilters(), contrast: 25, grayscale: true },
  },
  {
    id: "sunset",
    name: "Atardecer",
    filters: { ...emptyFilters(), brightness: 0.05, saturation: 0.4, hue: -15 },
  },
  {
    id: "cinema",
    name: "Cine",
    filters: { ...emptyFilters(), contrast: 18, saturation: 0.25, hue: -6 },
  },
  {
    id: "matte",
    name: "Mate",
    filters: {
      ...emptyFilters(),
      brightness: 0.04,
      contrast: -22,
      saturation: -0.05,
    },
  },
];

/**
 * Build a CSS `filter:` string from a SourceFilters blob, useful for
 * lightweight thumbnail previews (preset gallery). The Konva pipeline on
 * the actual canvas uses different APIs, but the visual approximation
 * here is close enough for picking a preset.
 */
export function filtersToCss(f: SourceFilters): string {
  const parts: string[] = [];
  if (f.brightness !== 0) parts.push(`brightness(${(1 + f.brightness).toFixed(3)})`);
  if (f.contrast !== 0) parts.push(`contrast(${(1 + f.contrast / 100).toFixed(3)})`);
  if (f.saturation !== 0) parts.push(`saturate(${(1 + f.saturation).toFixed(3)})`);
  if (f.hue !== 0) parts.push(`hue-rotate(${f.hue}deg)`);
  if (f.blur > 0) parts.push(`blur(${f.blur}px)`);
  if (f.grayscale) parts.push("grayscale(1)");
  if (f.sepia) parts.push("sepia(1)");
  if (f.invert) parts.push("invert(1)");
  return parts.length === 0 ? "none" : parts.join(" ");
}

/** Defensive parse of the filters blob, with sane defaults for missing fields. */
export function parseFilters(raw: unknown): SourceFilters {
  const f = emptyFilters();
  if (!raw || typeof raw !== "object") return f;
  const r = raw as Record<string, unknown>;
  if (typeof r.brightness === "number") f.brightness = r.brightness;
  if (typeof r.contrast === "number") f.contrast = r.contrast;
  if (typeof r.saturation === "number") f.saturation = r.saturation;
  if (typeof r.hue === "number") f.hue = r.hue;
  if (typeof r.blur === "number") f.blur = r.blur;
  if (typeof r.grayscale === "boolean") f.grayscale = r.grayscale;
  if (typeof r.sepia === "boolean") f.sepia = r.sepia;
  if (typeof r.invert === "boolean") f.invert = r.invert;
  return f;
}
