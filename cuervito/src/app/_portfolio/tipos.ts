/**
 * Los tipos del diseño de un portfolio: qué textos e imágenes tiene la página
 * (nodes), sus colores, letras, botones, grilla, logo y contacto.
 *
 * Vienen de photo-saas (lib/editor/types.ts) sin cambios de forma, para que
 * un diseño guardado allá o acá tenga la misma estructura. Lo único propio es
 * el texto de los valores por defecto, en castellano.
 */

export type NodeType =
  | "heading"
  | "paragraph"
  | "image"
  | "logo"
  | "nav-link"
  | "button";

export type Viewport = "mobile" | "tablet" | "desktop";

export interface EditorNode {
  id: string;
  type: NodeType;
  content?: string;
  src?: string;
  alt?: string;
  hidden?: boolean;
  /* Text style overrides — applied on top of template defaults */
  fontSize?: string;
  fontWeight?: number | string;
  fontStyle?: "normal" | "italic";
  textAlign?: "left" | "center" | "right";
  color?: string;
  fontFamily?: string;
  /* Image style overrides */
  objectFit?: "cover" | "contain" | "fill" | "none";
  objectPosition?: string;
}

export interface ColorPalette {
  bg: string;
  fg: string;
  accent: string;
  muted: string;
}

export interface Typography {
  serif: string;
  sans: string;
  mono: string;
}

/* Gallery grid for the "Selected work" section.
   - mosaic  → the editorial layout with mixed, art-directed cell sizes.
   - uniform → an even N-column grid of equal cells.
   - masonry → a VSCO/Pinterest-style grid that keeps each photo's natural
               aspect ratio, so boxes have different heights.
   `loadMore` (uniform + masonry) paginates every photo behind a "Load more"
   button instead of the "All projects" link. */
export interface GridSettings {
  /* "index" is a typographic project list (Halcyon); "corridor" is a walkable
     3D white-cube room (Vernissage); the rest are photo grids. Which layouts a
     template offers is declared per-template (TemplateDef.layouts). */
  layout:   "mosaic" | "uniform" | "masonry" | "index" | "corridor";
  columns:  number;            // 2..5 — uniform + masonry
  gap:      number;            // px between cells
  fit:      "cover" | "contain"; // how photos fill fixed cells (mosaic + uniform)
  loadMore: boolean;           // uniform + masonry
  pageSize: number;            // initial + per-batch count when loadMore is on
}

/* Global button styling. Empty bg/fg means "follow the palette"
   (bg → palette.fg, fg → palette.bg). */
export interface ButtonStyle {
  radius: number; // px
  bg: string;
  fg: string;
}

/* Crop region as percentages of the source image (0-100).
   `aspectRatio` is captured at crop time so renderers can size the wrapper
   without knowing the original image's intrinsic dimensions. */
export interface ImageCrop {
  x: number;
  y: number;
  w: number;
  h: number;
  aspectRatio: number;
}

export interface LogoSettings {
  mode: "text" | "image" | "image+text";
  text: string;
  imageUrl: string;
  altImageUrl: string;
  faviconUrl: string;
  /* Image logo width in px — height is auto to preserve aspect ratio */
  width: number;
  imageCrop?: ImageCrop;
}

/* Where the contact form sends submissions.
   - inbox    → stored in our app; the owner reads them in the dashboard Inbox.
   - whatsapp → opens WhatsApp to `whatsapp` with the filled `waTemplate`. */
export interface ContactSettings {
  mode: "inbox" | "whatsapp";
  whatsapp: string;    // recipient number (digits; may include +/spaces)
  waTemplate: string;  // default WhatsApp message — supports {name} {email} {message}
}

export interface EditorState {
  nodes: Record<string, EditorNode>;
  palette: ColorPalette;
  typography: Typography;
  buttons: ButtonStyle;
  grid: GridSettings;
  logo: LogoSettings;
  contact: ContactSettings;
  selectedId: string | null;
  editingId: string | null;
  viewport: Viewport;
  selectedSection: string | null;
  hoveredSection: string | null;
  hiddenSections: string[];
}

export const DEFAULT_PALETTE: ColorPalette = {
  bg:     "#fafafa",
  fg:     "#0a0a0a",
  accent: "#0a0a0a",
  muted:  "#6b7280",
};

export const DEFAULT_TYPOGRAPHY: Typography = {
  serif: "'Cormorant Garamond', Georgia, serif",
  sans:  "'DM Sans', system-ui, sans-serif",
  mono:  "'Space Mono', monospace",
};

export const DEFAULT_BUTTONS: ButtonStyle = {
  radius: 0,
  bg:     "",
  fg:     "",
};

export const DEFAULT_GRID: GridSettings = {
  layout:   "mosaic",
  columns:  3,
  gap:      3,
  fit:      "cover",
  loadMore: false,
  pageSize: 9,
};

export const DEFAULT_LOGO: LogoSettings = {
  mode:        "text",
  text:        "",
  imageUrl:    "",
  altImageUrl: "",
  faviconUrl:  "",
  width:       32,
};

export const DEFAULT_CONTACT: ContactSettings = {
  mode:       "inbox",
  whatsapp:   "",
  waTemplate: "¡Hola! Soy {name} ({email}), vi tu portfolio.\n\n{message}",
};
