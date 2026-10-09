import type { EditorNode } from "../tipos";
import {
  IconoCifras,
  IconoCinta,
  IconoGrilla,
  IconoLista,
  IconoMail,
  IconoNav,
  IconoPersona,
  IconoPie,
  IconoPortada,
} from "./iconos-secciones";
import type { SectionDef } from "./tipos";

/**
 * Podio: cartelería de estadio. Negro, amarillo señal, Anton enorme y cifras
 * de tablero. Los números salen de encontrate ({eventos}, {fotos},
 * {temporadas}); si uno da cero, su fila se oculta.
 */
export const PODIO_NODES: Record<string, EditorNode> = {
  /* Nav */
  "pd-nav-brand":    { id: "pd-nav-brand",    type: "logo",      content: "{nombre}" },
  "pd-nav-estado":   { id: "pd-nav-estado",   type: "paragraph", content: "● Disponible para coberturas" },

  /* Portada */
  "pd-hero-image":   { id: "pd-hero-image",   type: "image",     src: "", alt: "" },
  "pd-hero-eyebrow": { id: "pd-hero-eyebrow", type: "paragraph", content: "Fotografía deportiva" },
  "pd-hero-title":   { id: "pd-hero-title",   type: "heading",   content: "Barro, agua<br/>y llegada." },
  "pd-hero-sub":     { id: "pd-hero-sub",     type: "paragraph", content: "Cubro carreras desde la largada hasta la línea de meta. Cada vadeo, cada subida, cada cara en el último kilómetro." },
  "pd-hero-meta":    { id: "pd-hero-meta",    type: "paragraph", content: "{ubicacion}" },
  "pd-hero-cta-1":   { id: "pd-hero-cta-1",   type: "paragraph", content: "Ver trabajo" },
  "pd-hero-cta-2":   { id: "pd-hero-cta-2",   type: "paragraph", content: "Contacto" },

  /* Cinta */
  "pd-cinta":        { id: "pd-cinta",        type: "paragraph", content: "Mountain bike · Trail running · Triatlón · Running · Ciclismo · Duatlón" },

  /* Tablero */
  "pd-tablero-label": { id: "pd-tablero-label", type: "paragraph", content: "Tablero" },
  "pd-stat-1-value": { id: "pd-stat-1-value", type: "paragraph", content: "{eventos}" },
  "pd-stat-1-label": { id: "pd-stat-1-label", type: "paragraph", content: "Eventos cubiertos" },
  "pd-stat-2-value": { id: "pd-stat-2-value", type: "paragraph", content: "{fotos}" },
  "pd-stat-2-label": { id: "pd-stat-2-label", type: "paragraph", content: "Fotos que encontraron a su atleta" },
  "pd-stat-3-value": { id: "pd-stat-3-value", type: "paragraph", content: "{temporadas}" },
  "pd-stat-3-label": { id: "pd-stat-3-label", type: "paragraph", content: "Temporadas en la ruta" },

  /* Trabajo */
  "pd-work-title":   { id: "pd-work-title",   type: "heading",   content: "Trabajo" },

  /* Eventos */
  "pd-events-title": { id: "pd-events-title", type: "heading",   content: "Eventos" },
  "pd-events-intro": { id: "pd-events-intro", type: "paragraph", content: "Cada evento tiene su galería en encontrate. Buscá tu dorsal o subí una selfie y llevate tus fotos." },

  /* Sobre mí */
  "pd-about-label":   { id: "pd-about-label",   type: "paragraph", content: "Sobre mí" },
  "pd-about-image":   { id: "pd-about-image",   type: "image",     src: "", alt: "Retrato" },
  "pd-about-heading": { id: "pd-about-heading", type: "heading",   content: "Estoy donde <em>pasa</em> la carrera." },
  "pd-about-body-1":  { id: "pd-about-body-1",  type: "paragraph", content: "Me paro en el vadeo, en la subida más dura o a diez metros de la meta. Ahí es donde el atleta deja de posar." },
  "pd-about-body-2":  { id: "pd-about-body-2",  type: "paragraph", content: "Trabajo con organizadores de carreras de montaña, trail y running. Las fotos se suben el mismo día, con búsqueda por dorsal y por cara." },

  /* Contacto */
  "pd-contact-label":   { id: "pd-contact-label",   type: "paragraph", content: "Contacto" },
  "pd-contact-heading": { id: "pd-contact-heading", type: "heading",   content: "¿Cubrimos tu carrera?" },
  "pd-contact-body":    { id: "pd-contact-body",    type: "paragraph", content: "Contame fecha, lugar y cuántos corredores esperás. Respondo en el día." },

  /* Pie */
  "pd-footer-brand": { id: "pd-footer-brand", type: "logo",      content: "{nombre}" },
  "pd-footer-copy":  { id: "pd-footer-copy",  type: "paragraph", content: "© 2026 · Todas las fotos tienen derechos reservados" },
};

export const PODIO_SECTIONS: SectionDef[] = [
  { id: "section-nav", label: "Navegación", icon: <IconoNav />, locked: true,
    elements: [
      { nodeId: "pd-nav-brand",  label: "Logo",   type: "text" },
      { nodeId: "pd-nav-estado", label: "Estado", type: "text" },
    ] },
  { id: "pd-hero", label: "Portada", icon: <IconoPortada />, locked: false,
    elements: [
      { nodeId: "pd-hero-image",   label: "Foto de portada", type: "image" },
      { nodeId: "pd-hero-eyebrow", label: "Antetítulo",      type: "text" },
      { nodeId: "pd-hero-title",   label: "Título",          type: "text" },
      { nodeId: "pd-hero-sub",     label: "Bajada",          type: "text" },
      { nodeId: "pd-hero-meta",    label: "Línea de datos",  type: "text" },
      { nodeId: "pd-hero-cta-1",   label: "Botón 1 (celular)", type: "text" },
      { nodeId: "pd-hero-cta-2",   label: "Botón 2 (celular)", type: "text" },
    ] },
  { id: "pd-cinta", label: "Cinta de disciplinas", icon: <IconoCinta />, locked: false,
    elements: [
      { nodeId: "pd-cinta", label: "Disciplinas (separadas por ·)", type: "text" },
    ] },
  { id: "pd-tablero", label: "Tablero", icon: <IconoCifras />, locked: false,
    elements: [
      { nodeId: "pd-tablero-label", label: "Rótulo",          type: "text" },
      { nodeId: "pd-stat-1-value",  label: "Cifra 1 — valor",  type: "text" },
      { nodeId: "pd-stat-1-label",  label: "Cifra 1 — rótulo", type: "text" },
      { nodeId: "pd-stat-2-value",  label: "Cifra 2 — valor",  type: "text" },
      { nodeId: "pd-stat-2-label",  label: "Cifra 2 — rótulo", type: "text" },
      { nodeId: "pd-stat-3-value",  label: "Cifra 3 — valor",  type: "text" },
      { nodeId: "pd-stat-3-label",  label: "Cifra 3 — rótulo", type: "text" },
    ] },
  { id: "pd-work", label: "Trabajo", icon: <IconoGrilla />, locked: false,
    elements: [
      { nodeId: "pd-work-title", label: "Título", type: "text" },
    ] },
  { id: "pd-events", label: "Eventos", icon: <IconoLista />, locked: false,
    elements: [
      { nodeId: "pd-events-title", label: "Título", type: "text" },
      { nodeId: "pd-events-intro", label: "Texto",  type: "text" },
    ] },
  { id: "pd-about", label: "Sobre mí", icon: <IconoPersona />, locked: false,
    elements: [
      { nodeId: "pd-about-label",   label: "Rótulo",    type: "text" },
      { nodeId: "pd-about-image",   label: "Retrato",   type: "image" },
      { nodeId: "pd-about-heading", label: "Título",    type: "text" },
      { nodeId: "pd-about-body-1",  label: "Párrafo 1", type: "text" },
      { nodeId: "pd-about-body-2",  label: "Párrafo 2", type: "text" },
    ] },
  { id: "pd-contact", label: "Contacto", icon: <IconoMail />, locked: false,
    elements: [
      { nodeId: "pd-contact-label",   label: "Rótulo", type: "text" },
      { nodeId: "pd-contact-heading", label: "Título", type: "text" },
      { nodeId: "pd-contact-body",    label: "Texto",  type: "text" },
    ] },
  { id: "section-footer", label: "Pie", icon: <IconoPie />, locked: true,
    elements: [
      { nodeId: "pd-footer-brand", label: "Nombre",   type: "text" },
      { nodeId: "pd-footer-copy",  label: "Derechos", type: "text" },
    ] },
];
