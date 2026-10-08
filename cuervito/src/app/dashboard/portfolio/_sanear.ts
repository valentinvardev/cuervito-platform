import { z } from "zod";

import { FAMILIAS } from "~/app/_portfolio/familias";
import { esPlantilla } from "~/app/_portfolio/plantillas/registro";
import type { PortfolioDesign } from "~/app/_portfolio/store";

/**
 * El diseño que manda el editor, antes de guardarlo.
 *
 * Los textos de las plantillas son HTML (los títulos llevan <em> y <br/>) y
 * la página pública los pinta con dangerouslySetInnerHTML. Lo escribe el
 * dueño, pero el dueño es un navegador que puede mandar cualquier cosa: un
 * <script> o un onerror guardado acá correría en la página de cada visitante.
 * Así que se escapa TODO y después se devuelven sólo las etiquetas que una
 * plantilla usa, sin atributos.
 *
 * Los colores tienen que ser hex, las fuentes una de las de familias.ts (van
 * a un style) y las imágenes, https.
 */

const PERMITIDAS = /&lt;(\/?)(em|strong|b|i)&gt;|&lt;br\s*\/?&gt;/gi;

export function sanearHtml(html: string): string {
  const escapado = html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  return escapado
    .replace(PERMITIDAS, (m: string, cierre: string | undefined, tag: string | undefined) =>
      tag ? `<${cierre ?? ""}${tag.toLowerCase()}>` : "<br/>",
    )
    .slice(0, 4000);
}

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const familia = z.enum(Object.values(FAMILIAS) as [string, ...string[]]);
const https = z.string().max(2000).refine((s) => s === "" || s.startsWith("https://"), "imagen inválida");
/** Una imagen del diseño: una foto del portfolio por referencia, o vacía. */
const refFoto = z.string().regex(/^(foto:[a-z0-9-]{10,40})?$/, "imagen inválida");

const nodo = z.object({
  id: z.string().max(80),
  type: z.enum(["heading", "paragraph", "image", "logo", "nav-link", "button"]),
  content: z.string().max(8000).optional(),
  src: refFoto.optional(),
  alt: z.string().max(300).optional(),
  hidden: z.boolean().optional(),
  fontSize: z.string().regex(/^\d{1,3}(px|rem|em)$/).optional(),
  fontWeight: z.union([z.number().int().min(100).max(900), z.string().regex(/^\d{3}$/)]).optional(),
  fontStyle: z.enum(["normal", "italic"]).optional(),
  textAlign: z.enum(["left", "center", "right"]).optional(),
  color: hex.optional(),
  fontFamily: familia.optional(),
  objectFit: z.enum(["cover", "contain", "fill", "none"]).optional(),
  objectPosition: z.string().regex(/^\d{1,3}% \d{1,3}%$/).optional(),
});

const disenoSchema = z.object({
  templateId: z.string().refine(esPlantilla),
  nodes: z.record(z.string().max(80), nodo).optional(),
  palette: z.object({ bg: hex, fg: hex, accent: hex, muted: hex }).optional(),
  typography: z.object({ serif: familia, sans: familia, mono: familia }).optional(),
  buttons: z.object({ radius: z.number().min(0).max(40), bg: hex.or(z.literal("")), fg: hex.or(z.literal("")) }).optional(),
  grid: z
    .object({
      layout: z.enum(["mosaic", "uniform", "masonry", "index", "corridor"]),
      columns: z.number().int().min(1).max(6),
      gap: z.number().min(0).max(60),
      fit: z.enum(["cover", "contain"]),
      loadMore: z.boolean(),
      pageSize: z.number().int().min(3).max(60),
    })
    .optional(),
  logo: z
    .object({
      mode: z.enum(["text", "image", "image+text"]),
      text: z.string().max(80),
      imageUrl: https,
      altImageUrl: https,
      faviconUrl: https,
      width: z.number().min(8).max(400),
    })
    .optional(),
  contact: z
    .object({
      mode: z.enum(["inbox", "whatsapp"]),
      whatsapp: z.string().max(30).regex(/^[\d +()-]*$/),
      waTemplate: z.string().max(1000),
    })
    .optional(),
  hiddenSections: z.array(z.string().regex(/^[\w-]{1,60}$/)).max(30).optional(),
});

export function sanearDiseno(entrada: unknown): PortfolioDesign | null {
  const d = disenoSchema.safeParse(entrada);
  if (!d.success) return null;
  const nodes = d.data.nodes
    ? Object.fromEntries(
        Object.entries(d.data.nodes).map(([k, n]) => [
          k,
          n.content !== undefined ? { ...n, content: sanearHtml(n.content) } : n,
        ]),
      )
    : undefined;
  return { ...d.data, templateId: d.data.templateId as PortfolioDesign["templateId"], nodes };
}
