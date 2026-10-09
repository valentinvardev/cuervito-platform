import type { ButtonStyle, ColorPalette, EditorNode, GridSettings, LogoSettings, Typography } from "../tipos";

export interface SectionElement {
  nodeId: string;
  label: string;
  type: "text" | "image";
}

export interface SectionDef {
  id: string;
  label: string;
  icon: React.ReactNode;
  locked: boolean;
  elements: SectionElement[];
}

/**
 * Lo que una plantilla trae de fábrica: sus textos, sus secciones y su diseño
 * por defecto. El componente que la dibuja NO va acá sino en componentes.tsx:
 * el store necesita los valores por defecto, el componente necesita el store,
 * y si los dos vivieran en el mismo módulo la importación sería circular.
 */
export interface TemplateDef {
  id: string;
  name: string;
  /** Una línea para el selector del asistente. */
  descripcion: string;
  initialNodes: Record<string, EditorNode>;
  sections: SectionDef[];
  defaultPalette?: ColorPalette;
  defaultTypography?: Typography;
  defaultButtons?: ButtonStyle;
  defaultLogo?: LogoSettings;
  defaultGrid?: GridSettings;
  /** Las grillas que ofrece la sección de trabajo, en el orden del panel.
   *  Vacío: la plantilla muestra las fotos a su manera y no hay qué elegir. */
  layouts?: GridSettings["layout"][];
}
