export type TemplateId =
  | "encontrate"
  | "dark"
  | "light"
  | "sport"
  | "feed"
  | "pista"
  | "podio"
  | "noche"
  | "cancha"
  | "tablero"
  | "velvet";

/**
 * Layout family: templates with the same layout share the same React shell
 * and differ only in CSS variables. A different layout requires its own shell
 * component on the public storefront.
 */
export type TemplateLayout = "encontrate" | "coverage" | "feed";

/**
 * Las tipografías que puede pedir una plantilla con tema. La clave es un
 * nombre nuestro y no el de Google: next/font registra cada familia con un
 * nombre generado, y el que sabe cuál es es styles/v2/fuentes-plantillas.
 */
export type ClaveFuente =
  | "barlow"
  | "barlow-condensed"
  | "archivo"
  | "archivo-black"
  | "archivo-ancha"
  | "space-grotesk"
  | "inter"
  | "sora"
  | "manrope"
  | "geist";

export interface StorefrontTemplate {
  id: TemplateId;
  name: string;
  description: string;
  layout: TemplateLayout;
  cssVars: Record<string, string>;
  /**
   * Las plantillas con tema propio (Pista, Podio, Noche, Cancha, Tablero).
   *
   * Dibujan la MISMA página que encontrate —misma barra, mismo buscador,
   * mismo carrito— y se distinguen por CSS: el <html> lleva
   * `data-plantilla="<id>"` y styles/tienda-temas.css redefine desde ahí
   * tipografías, radios, bordes y cómo se lista cada cosa. Así una
   * plantilla nueva no es otra copia del carrito esperando divergir.
   */
  tema?: {
    fuentes: { sans: ClaveFuente; display: ClaveFuente };
    /** Dos colores de marca: el principal (--accent) y el secundario
     *  (--accent-2). Sólo Cancha; las demás llevan uno. */
    dosColores?: boolean;
  };
}

/**
 * La plantilla de las cuentas que nunca eligieron una (la columna en null) y
 * de cualquier id que ya no exista. Antes era la oscura, la primera de la
 * lista, y la nueva sólo la traían las cuentas creadas después; ahora es la de
 * todos los que no eligieron otra.
 */
export const PLANTILLA_POR_DEFECTO: TemplateId = "encontrate";

export const TEMPLATES: readonly StorefrontTemplate[] = [
  {
    id: "dark",
    name: "Oscuro",
    description: "Cálido y profundo — hace resaltar tus fotos",
    layout: "coverage",
    cssVars: {
      "--nav-bg": "rgba(15,13,11,0.88)",
    },
  },
  {
    id: "light",
    name: "Claro",
    description: "Limpio y editorial — estilo galería de arte",
    layout: "coverage",
    cssVars: {
      "--bg-base":        "#F7F4F0",
      "--bg-surface":     "#FFFFFF",
      "--bg-elevated":    "#EDE9E3",
      "--bg-subtle":      "#E5E0D8",
      "--text-primary":   "#1A1410",
      "--text-secondary": "#5A4E44",
      "--text-tertiary":  "#9C8C7A",
      "--text-on-accent": "#FFFFFF",
      "--border-subtle":  "rgba(0,0,0,0.07)",
      "--border-default": "rgba(0,0,0,0.12)",
      "--border-strong":  "rgba(0,0,0,0.22)",
      "--border-accent":  "rgba(245,130,10,0.35)",
      "--nav-bg":         "rgba(247,244,240,0.92)",
    },
  },
  {
    id: "sport",
    name: "Deportivo",
    description: "Negro puro, contraste máximo — energía de competencia",
    layout: "coverage",
    cssVars: {
      "--bg-base":        "#000000",
      "--bg-surface":     "#0D0D0D",
      "--bg-elevated":    "#161616",
      "--bg-subtle":      "#202020",
      "--text-primary":   "#FFFFFF",
      "--text-secondary": "#BBBBBB",
      "--text-tertiary":  "#777777",
      "--border-subtle":  "rgba(255,255,255,0.06)",
      "--border-default": "rgba(255,255,255,0.12)",
      "--border-strong":  "rgba(255,255,255,0.22)",
      "--nav-bg":         "rgba(0,0,0,0.92)",
    },
  },
  {
    id: "encontrate",
    name: "encontrate",
    description: "Claro y minimalista — la foto es lo único con color",
    layout: "encontrate",
    cssVars: {
      "--bg-base": "#FBFAF8",
      "--bg-surface": "#FFFFFF",
      "--bg-elevated": "#F2F0EC",
      "--bg-subtle": "#EAE7E2",
      "--text-primary": "#12110F",
      "--text-secondary": "#4A453F",
      "--text-tertiary": "#8B857D",
      "--text-on-accent": "#FFFFFF",
      "--border-subtle": "rgba(18,17,15,0.07)",
      "--border-default": "rgba(18,17,15,0.12)",
      "--border-strong": "rgba(18,17,15,0.2)",
      "--nav-bg": "rgba(251,250,248,0.88)",
    },
  },
  {
    id: "feed",
    name: "Feed",
    description: "Búsqueda al frente, fotos en feed vertical — pensado para mobile",
    layout: "feed",
    cssVars: {
      "--bg-base":     "#0B0908",
      "--bg-surface":  "#141110",
      "--bg-elevated": "#1F1B19",
      "--nav-bg":      "rgba(11,9,8,0.92)",
    },
  },

  /* ── Las cinco con tema ───────────────────────────────────────────────────
     Mismo armazón que encontrate, otra piel. El acento de cada una es el de
     fábrica: el color de marca del fotógrafo lo reemplaza, igual que en las
     demás. Los neutros (fondo, superficie, tinta, filetes) son de la
     plantilla y no se tocan. */
  {
    id: "pista",
    name: "Pista",
    description: "Lista de largada — condensada, oscura, con tu color como LED",
    layout: "encontrate",
    tema: { fuentes: { sans: "barlow", display: "barlow-condensed" } },
    cssVars: {
      "--bg-base":        "#0B0B0C",
      "--bg-surface":     "#141416",
      "--bg-elevated":    "#1A1A1D",
      "--bg-subtle":      "#202024",
      "--text-primary":   "#F2F2F0",
      "--text-secondary": "#C9C9CC",
      "--text-tertiary":  "#8F8F93",
      "--text-on-accent": "#0B0B0C",
      "--border-subtle":  "rgba(242,242,240,0.06)",
      "--border-default": "#2A2A2E",
      "--border-strong":  "#3A3A3F",
      "--nav-bg":         "rgba(11,11,12,0.9)",
      "--accent":         "#FFB000",
    },
  },
  {
    id: "podio",
    name: "Podio",
    description: "Afiche editorial — reglas de tinta y eventos como fixture",
    layout: "encontrate",
    tema: { fuentes: { sans: "archivo", display: "archivo-black" } },
    cssVars: {
      "--bg-base":        "#FFFFFF",
      "--bg-surface":     "#FFFFFF",
      "--bg-elevated":    "#F4F4F4",
      "--bg-subtle":      "#E6E6E6",
      "--text-primary":   "#0A0A0A",
      "--text-secondary": "#3A3A3A",
      "--text-tertiary":  "#5A5A5A",
      "--text-on-accent": "#FFFFFF",
      "--border-subtle":  "#E6E6E6",
      "--border-default": "rgba(10,10,10,0.14)",
      "--border-strong":  "#0A0A0A",
      "--nav-bg":         "rgba(255,255,255,0.92)",
      "--accent":         "#1F3BE6",
    },
  },
  {
    id: "noche",
    name: "Noche",
    description: "Transmisión nocturna — vidrio, feed y un brillo de tu color",
    layout: "encontrate",
    tema: { fuentes: { sans: "inter", display: "space-grotesk" } },
    cssVars: {
      "--bg-base":        "#060807",
      "--bg-surface":     "#0F1411",
      "--bg-elevated":    "#141A16",
      "--bg-subtle":      "#1D2621",
      "--text-primary":   "#E6EFE8",
      "--text-secondary": "#A9B5AD",
      "--text-tertiary":  "#7C8A80",
      "--text-on-accent": "#060807",
      "--border-subtle":  "rgba(230,239,232,0.08)",
      "--border-default": "#1D2621",
      "--border-strong":  "#2A3630",
      "--nav-bg":         "rgba(6,8,7,0.85)",
      "--accent":         "#3DF27C",
    },
  },
  {
    id: "cancha",
    name: "Cancha",
    description: "Camiseta de club — dos colores, banda y etiquetas",
    layout: "encontrate",
    tema: { fuentes: { sans: "manrope", display: "sora" }, dosColores: true },
    cssVars: {
      "--bg-base":        "#EEF0F2",
      "--bg-surface":     "#FFFFFF",
      "--bg-elevated":    "#F5F6F8",
      "--bg-subtle":      "#DCE1E6",
      "--text-primary":   "#0B0F14",
      "--text-secondary": "#3B4654",
      "--text-tertiary":  "#6E7781",
      "--text-on-accent": "#FFFFFF",
      "--border-subtle":  "rgba(11,37,69,0.08)",
      "--border-default": "rgba(11,37,69,0.12)",
      "--border-strong":  "rgba(11,37,69,0.22)",
      "--nav-bg":         "rgba(255,255,255,0.95)",
      "--accent":         "#0B2545",
      "--accent-2":       "#FF6A2B",
    },
  },
  {
    id: "tablero",
    name: "Tablero",
    description: "Baldosas con cifras grandes — tu color en una sola baldosa",
    layout: "encontrate",
    tema: { fuentes: { sans: "geist", display: "geist" } },
    cssVars: {
      "--bg-base":        "#F6F8F9",
      "--bg-surface":     "#FFFFFF",
      "--bg-elevated":    "#EDF1F3",
      "--bg-subtle":      "#DDE3E7",
      "--text-primary":   "#2B3238",
      "--text-secondary": "#4B5560",
      "--text-tertiary":  "#6B7580",
      "--text-on-accent": "#FFFFFF",
      "--border-subtle":  "#E8EDF0",
      "--border-default": "#DDE3E7",
      "--border-strong":  "#C9D3D9",
      "--nav-bg":         "rgba(246,248,249,0.92)",
      "--accent":         "#1F5E3A",
    },
  },
  {
    // Hecha para una marca de fotografía deportiva de logo rojo: negro, el
    // rojo como único color fuera de las fotos, títulos anchos e itálicos y
    // todo entrando animado. El rojo es el acento de fábrica; si el
    // fotógrafo elige otro color, lo reemplaza como en las demás.
    id: "velvet",
    name: "Velvet",
    description: "Negro y rojo — títulos itálicos, una cinta inclinada y fotos que entran en cascada",
    layout: "encontrate",
    tema: { fuentes: { sans: "barlow", display: "archivo-ancha" } },
    cssVars: {
      "--bg-base":        "#0A0A0A",
      "--bg-surface":     "#121212",
      "--bg-elevated":    "#1A1A1A",
      "--bg-subtle":      "#232323",
      "--text-primary":   "#FFFFFF",
      "--text-secondary": "#B3B3B3",
      "--text-tertiary":  "#8A8A8A",
      "--text-on-accent": "#FFFFFF",
      "--border-subtle":  "rgba(255,255,255,0.06)",
      "--border-default": "rgba(255,255,255,0.12)",
      "--border-strong":  "rgba(255,255,255,0.22)",
      "--nav-bg":         "rgba(10,10,10,0.82)",
      "--accent":         "#E30A1C",
    },
  },
] as const;

export function getTemplate(id: string | null | undefined): StorefrontTemplate {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES.find((t) => t.id === PLANTILLA_POR_DEFECTO)!;
}

/** ¿Es un id del catálogo? Lo usan la acción que guarda y la vista previa. */
export function esPlantilla(id: string | null | undefined): id is TemplateId {
  return TEMPLATES.some((t) => t.id === id);
}

/** El acento de fábrica de una plantilla, el que lleva si el fotógrafo no
 *  eligió color. El bermellón es el de la tienda base. */
export function acentoDe(t: StorefrontTemplate): string {
  return t.cssVars["--accent"] ?? "#F0410F";
}

/** El secundario de fábrica. Null si la plantilla lleva un solo color. */
export function acento2De(t: StorefrontTemplate): string | null {
  return t.tema?.dosColores ? (t.cssVars["--accent-2"] ?? null) : null;
}

/**
 * Lo que la tienda hereda cuando la plantilla no define una variable: los
 * valores base de la tienda oscura (styles/prototype/styles.css). Las
 * plantillas oscuras sólo pisan la barra y dejan el resto en estos.
 */
const BASE_OSCURA = {
  "--bg-base": "#0F0D0B",
  "--bg-surface": "#181511",
  "--text-primary": "#F0EBE3",
  "--text-tertiary": "#6B5D50",
  "--border-default": "rgba(240,235,227,0.12)",
} as const;

/**
 * Los colores con los que el panel dibuja la miniatura de una plantilla.
 * Salen de las mismas variables que usa la tienda, así una plantilla que
 * cambia de fondo cambia de miniatura sola, sin que nadie la vuelva a pintar.
 */
export function paletaDePlantilla(t: StorefrontTemplate) {
  const v = (k: keyof typeof BASE_OSCURA) => t.cssVars[k] ?? BASE_OSCURA[k];
  return {
    fondo: v("--bg-base"),
    superficie: v("--bg-surface"),
    texto: v("--text-primary"),
    texto2: v("--text-tertiary"),
    linea: v("--border-default"),
  };
}

/**
 * Clara u oscura, medido sobre el fondo. Es lo primero que se nota de una
 * plantilla y lo que la etiqueta tiene que decir; medirlo evita que la
 * etiqueta y el color se desencuentren.
 */
export function tonoDePlantilla(t: StorefrontTemplate): "clara" | "oscura" {
  let hex = paletaDePlantilla(t).fondo.replace("#", "");
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  const n = parseInt(hex, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 140 ? "clara" : "oscura";
}

/**
 * Las variables de la plantilla con los colores del fotógrafo encima.
 *
 * El color de marca pisa el acento de fábrica. El secundario sólo existe en
 * las plantillas de dos colores: en las otras ni se escribe, así ninguna
 * hoja lo lee por accidente.
 */
function variablesDe(
  templateId: string | null | undefined,
  brandColor: string | null | undefined,
  brandColor2?: string | null,
): Record<string, string> {
  const tpl = getTemplate(templateId);
  const vars: Record<string, string> = { ...tpl.cssVars };
  if (brandColor) vars["--accent"] = brandColor;
  if (tpl.tema?.dosColores) {
    if (brandColor2) vars["--accent-2"] = brandColor2;
  } else {
    delete vars["--accent-2"];
  }
  return vars;
}

export function buildTemplateStyle(
  templateId: string | null | undefined,
  brandColor: string | null | undefined,
  brandColor2?: string | null,
): React.CSSProperties {
  return {
    ...variablesDe(templateId, brandColor, brandColor2),
    minHeight: "100vh",
    background: "var(--bg-base)",
    color: "var(--text-primary)",
  };
}

/**
 * El atributo que activa la piel de una plantilla con tema, para ponerlo en
 * el <div> que envuelve la página. Las hojas lo buscan en cualquier
 * antecesor (`[data-plantilla="pista"] .et-…`), así que vale tanto acá como
 * en el <html>, donde lo pone el script de _cabeza antes del primer pintado.
 * Para las plantillas sin tema no devuelve nada.
 */
export function atributosPlantilla(
  templateId: string | null | undefined,
): { "data-plantilla"?: string } {
  const tpl = getTemplate(templateId);
  return tpl.tema ? { "data-plantilla": tpl.id } : {};
}

/**
 * Generates a <style> tag string that overrides :root CSS vars for the
 * storefront template. Injected server-side so the body background is correct
 * before first paint — prevents the dark flash when using light/sport themes.
 */
export function buildTemplateCSSOverride(
  templateId: string | null | undefined,
  brandColor: string | null | undefined,
  brandColor2?: string | null,
): string {
  const vars = variablesDe(templateId, brandColor, brandColor2);
  if (Object.keys(vars).length === 0) return "";
  const declarations = Object.entries(vars)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join("\n");
  return `:root {\n${declarations}\n}`;
}
