import type { EditorNode } from "../tipos";
import {
  IconoCifras,
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
 * Kilómetro: revista outdoor. Arena, tinta y terracota; Manrope para todo y
 * esquinas redondeadas grandes. El trabajo va en carruseles, uno por evento,
 * y las cifras salen de encontrate ({eventos}, {fotos}, {temporadas}): la que
 * da cero no aparece.
 *
 * Los rótulos de sección («Trabajo», «Eventos») son también los textos del
 * menú.
 */
export const KILOMETRO_NODES: Record<string, EditorNode> = {
  /* Nav */
  "km-nav-brand":  { id: "km-nav-brand",  type: "logo",      content: "{nombre}" },
  "km-nav-cta":    { id: "km-nav-cta",    type: "paragraph", content: "Contacto" },

  /* Portada (las imágenes en este orden: portada, retrato) */
  "km-hero-image": { id: "km-hero-image", type: "image",     src: "", alt: "" },
  "km-hero-chip":  { id: "km-hero-chip",  type: "paragraph", content: "Fotografía outdoor" },
  "km-hero-meta":  { id: "km-hero-meta",  type: "paragraph", content: "{ubicacion}" },
  "km-hero-title": { id: "km-hero-title", type: "heading",   content: "Cada kilómetro<br/>tiene su <em>foto.</em>" },
  "km-hero-sub":   { id: "km-hero-sub",   type: "paragraph", content: "Trail, mountain bike y aventura. Galerías el mismo día, con búsqueda por dorsal y por cara." },
  "km-hero-cta-1": { id: "km-hero-cta-1", type: "paragraph", content: "Ver el trabajo" },
  "km-hero-cta-2": { id: "km-hero-cta-2", type: "paragraph", content: "Escribime" },
  "km-hero-badge": { id: "km-hero-badge", type: "paragraph", content: "Fotos el mismo día" },

  /* Cifras */
  "km-stat-1-value": { id: "km-stat-1-value", type: "paragraph", content: "{eventos}" },
  "km-stat-1-label": { id: "km-stat-1-label", type: "paragraph", content: "eventos cubiertos" },
  "km-stat-2-value": { id: "km-stat-2-value", type: "paragraph", content: "{fotos}" },
  "km-stat-2-label": { id: "km-stat-2-label", type: "paragraph", content: "fotos encontradas" },
  "km-stat-3-value": { id: "km-stat-3-value", type: "paragraph", content: "{temporadas}" },
  "km-stat-3-label": { id: "km-stat-3-label", type: "paragraph", content: "temporadas en la ruta" },

  /* Trabajo */
  "km-work-label":   { id: "km-work-label",   type: "paragraph", content: "Trabajo" },
  "km-work-heading": { id: "km-work-heading", type: "heading",   content: "Cada carrera, <em>su recorrido.</em>" },
  "km-work-intro":   { id: "km-work-intro",   type: "paragraph", content: "Las fotos van por evento, en el orden en que pasaron. Deslizá cada fila para recorrerla." },

  /* Eventos */
  "km-events-label":   { id: "km-events-label",   type: "paragraph", content: "Eventos" },
  "km-events-heading": { id: "km-events-heading", type: "heading",   content: "Buscá tu foto en la <em>galería.</em>" },
  "km-events-intro":   { id: "km-events-intro",   type: "paragraph", content: "Cada evento abre su galería en encontrate: buscá tu dorsal o subí una selfie." },

  /* Sobre mí */
  "km-about-label":   { id: "km-about-label",   type: "paragraph", content: "Sobre mí" },
  "km-about-image":   { id: "km-about-image",   type: "image",     src: "", alt: "Retrato" },
  "km-about-heading": { id: "km-about-heading", type: "heading",   content: "Llego antes de la largada y me voy con el último." },
  "km-about-body":    { id: "km-about-body",    type: "paragraph", content: "Trabajo con organizadores de trail, mountain bike y carreras de aventura. Elijo el punto donde la carrera se pone difícil y me quedo ahí hasta que pasa el último corredor. Las fotos se suben el mismo día, y cada atleta encuentra las suyas con su dorsal o una selfie." },

  /* Contacto */
  "km-contact-label":   { id: "km-contact-label",   type: "paragraph", content: "Contacto" },
  "km-contact-heading": { id: "km-contact-heading", type: "heading",   content: "¿Tenés una carrera en el calendario?" },
  "km-contact-body":    { id: "km-contact-body",    type: "paragraph", content: "Contame la fecha, el lugar y cuántos corredores esperás. Respondo en el día." },

  /* Pie */
  "km-footer-brand": { id: "km-footer-brand", type: "logo",      content: "{nombre}" },
  "km-footer-copy":  { id: "km-footer-copy",  type: "paragraph", content: "© 2026 · Todas las fotos tienen derechos reservados" },
};

export const KILOMETRO_SECTIONS: SectionDef[] = [
  { id: "section-nav", label: "Navegación", icon: <IconoNav />, locked: true,
    elements: [
      { nodeId: "km-nav-brand", label: "Logo",  type: "text" },
      { nodeId: "km-nav-cta",   label: "Botón", type: "text" },
    ] },
  { id: "km-hero", label: "Portada", icon: <IconoPortada />, locked: false,
    elements: [
      { nodeId: "km-hero-image", label: "Foto",           type: "image" },
      { nodeId: "km-hero-chip",  label: "Etiqueta",       type: "text" },
      { nodeId: "km-hero-meta",  label: "Línea de datos", type: "text" },
      { nodeId: "km-hero-title", label: "Título",         type: "text" },
      { nodeId: "km-hero-sub",   label: "Bajada",         type: "text" },
      { nodeId: "km-hero-cta-1", label: "Botón 1",        type: "text" },
      { nodeId: "km-hero-cta-2", label: "Botón 2",        type: "text" },
      { nodeId: "km-hero-badge", label: "Sello de la foto", type: "text" },
    ] },
  { id: "km-cifras", label: "Cifras", icon: <IconoCifras />, locked: false,
    elements: [
      { nodeId: "km-stat-1-value", label: "Cifra 1 — valor",  type: "text" },
      { nodeId: "km-stat-1-label", label: "Cifra 1 — rótulo", type: "text" },
      { nodeId: "km-stat-2-value", label: "Cifra 2 — valor",  type: "text" },
      { nodeId: "km-stat-2-label", label: "Cifra 2 — rótulo", type: "text" },
      { nodeId: "km-stat-3-value", label: "Cifra 3 — valor",  type: "text" },
      { nodeId: "km-stat-3-label", label: "Cifra 3 — rótulo", type: "text" },
    ] },
  { id: "km-work", label: "Trabajo", icon: <IconoGrilla />, locked: false,
    elements: [
      { nodeId: "km-work-label",   label: "Rótulo (y menú)", type: "text" },
      { nodeId: "km-work-heading", label: "Título",          type: "text" },
      { nodeId: "km-work-intro",   label: "Texto",           type: "text" },
    ] },
  { id: "km-events", label: "Eventos", icon: <IconoLista />, locked: false,
    elements: [
      { nodeId: "km-events-label",   label: "Rótulo (y menú)", type: "text" },
      { nodeId: "km-events-heading", label: "Título",          type: "text" },
      { nodeId: "km-events-intro",   label: "Texto",           type: "text" },
    ] },
  { id: "km-about", label: "Sobre mí", icon: <IconoPersona />, locked: false,
    elements: [
      { nodeId: "km-about-label",   label: "Rótulo (y menú)", type: "text" },
      { nodeId: "km-about-image",   label: "Retrato",         type: "image" },
      { nodeId: "km-about-heading", label: "Título",          type: "text" },
      { nodeId: "km-about-body",    label: "Bio",             type: "text" },
    ] },
  { id: "km-contact", label: "Contacto", icon: <IconoMail />, locked: false,
    elements: [
      { nodeId: "km-contact-label",   label: "Rótulo (y menú)", type: "text" },
      { nodeId: "km-contact-heading", label: "Título",          type: "text" },
      { nodeId: "km-contact-body",    label: "Texto",           type: "text" },
    ] },
  { id: "section-footer", label: "Pie", icon: <IconoPie />, locked: true,
    elements: [
      { nodeId: "km-footer-brand", label: "Nombre",   type: "text" },
      { nodeId: "km-footer-copy",  label: "Derechos", type: "text" },
    ] },
];
