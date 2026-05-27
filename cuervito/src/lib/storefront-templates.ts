export type TemplateId = "dark" | "light" | "sport";

export interface StorefrontTemplate {
  id: TemplateId;
  name: string;
  description: string;
  cssVars: Record<string, string>;
}

export const TEMPLATES: readonly StorefrontTemplate[] = [
  {
    id: "dark",
    name: "Oscuro",
    description: "Cálido y profundo — hace resaltar tus fotos",
    cssVars: {
      "--nav-bg": "rgba(15,13,11,0.88)",
    },
  },
  {
    id: "light",
    name: "Claro",
    description: "Limpio y editorial — estilo galería de arte",
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
