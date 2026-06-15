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
  fontFamily: string;
  fontSize: number;
  fontWeight: 400 | 500 | 600 | 700 | 800;
  align: "left" | "center" | "right";
  color: string;
  width: number; // text box width — wraps within
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

export type Layer = TextLayer | RectLayer | EllipseLayer;

export type EditorDoc = {
  width: number;
  height: number;
  /** S3 key of the source/background photo, null = blank canvas. */
  sourceKey: string | null;
  /** Bottom-to-top render order. layers[0] = furthest back. */
  layers: Layer[];
};

export function emptyDoc(width = 1080, height = 1080): EditorDoc {
  return { width, height, sourceKey: null, layers: [] };
}

/** Create a layer with sensible defaults at the canvas center. */
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
    fontFamily: "Inter, system-ui, sans-serif",
    fontSize: 64,
    fontWeight: 700,
    align: "center",
    color: "#ffffff",
    width: Math.round(canvasW * 0.6),
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

function cryptoRandomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 12);
}

export function layerLabel(layer: Layer): string {
  if (layer.type === "text") return `T  ${layer.text.slice(0, 24)}`;
  if (layer.type === "rect") return "Rectángulo";
  return "Elipse";
}

/** Deserialize the JSON layers blob from the DB back to typed shape. */
export function parseLayers(raw: unknown): Layer[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((l): l is Layer => {
    if (!l || typeof l !== "object") return false;
    const t = (l as { type?: unknown }).type;
    return t === "text" || t === "rect" || t === "ellipse";
  });
}
