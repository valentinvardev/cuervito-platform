export type TemplateId = "encontrate" | "dark" | "light" | "sport" | "feed";

/**
 * Layout family: templates with the same layout share the same React shell
 * and differ only in CSS variables. A different layout requires its own shell
 * component on the public storefront.
 */
export type TemplateLayout = "encontrate" | "coverage" | "feed";

export interface StorefrontTemplate {
  id: TemplateId;
  name: string;
  description: string;
  layout: TemplateLayout;
  cssVars: Record<string, string>;
}

/**
 * OJO con el orden: getTemplate() devuelve TEMPLATES[0] cuando no encuentra el
 * id, y esa es la plantilla que ven las cuentas sin elegir. NO se puede poner
 * la nueva primera sin cambiarle la página a todos los que nunca eligieron.
 * La oscura sigue siendo el respaldo; la nueva se asigna explícitamente al
 * crear la cuenta, así que la traen las nuevas y sólo las nuevas.
 */
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
] as const;

export function getTemplate(id: string | null | undefined): StorefrontTemplate {
  return (TEMPLATES.find((t) => t.id === id) as StorefrontTemplate | undefined) ?? TEMPLATES[0]!;
}

export function buildTemplateStyle(
  templateId: string | null | undefined,
  brandColor: string | null | undefined,
): React.CSSProperties {
  const tpl = getTemplate(templateId);
  return {
    ...tpl.cssVars,
    ...(brandColor ? { "--accent": brandColor } : {}),
    minHeight: "100vh",
    background: "var(--bg-base)",
    color: "var(--text-primary)",
  } as React.CSSProperties;
}

/**
 * Generates a <style> tag string that overrides :root CSS vars for the
 * storefront template. Injected server-side so the body background is correct
 * before first paint — prevents the dark flash when using light/sport themes.
 */
export function buildTemplateCSSOverride(
  templateId: string | null | undefined,
  brandColor: string | null | undefined,
): string {
  const tpl = getTemplate(templateId);
  const vars: Record<string, string> = { ...tpl.cssVars };
  if (brandColor) {
    vars["--accent"] = brandColor;
  }
  if (Object.keys(vars).length === 0) return "";
  const declarations = Object.entries(vars)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join("\n");
  return `:root {\n${declarations}\n}`;
}
