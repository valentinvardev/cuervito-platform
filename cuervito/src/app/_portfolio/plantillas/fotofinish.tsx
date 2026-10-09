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
 * Fotofinish: revista suiza. Blanco, cobalto, Instrument Sans ajustada y una
 * grilla con riel de rótulos a la izquierda. Las cifras salen de encontrate
 * ({eventos}, {fotos}, {temporadas}); si una da cero, se oculta.
 */
export const FOTOFINISH_NODES: Record<string, EditorNode> = {
  /* Nav */
  "ff-nav-brand":  { id: "ff-nav-brand",  type: "logo",      content: "{nombre}" },
  "ff-nav-sub":    { id: "ff-nav-sub",    type: "paragraph", content: "Fotografía deportiva — Índice" },
  "ff-nav-estado": { id: "ff-nav-estado", type: "paragraph", content: "Disponible para la temporada" },

  /* Portada */
  "ff-hero-title": { id: "ff-hero-title", type: "heading",   content: "Fotos que llegan<br/>antes que el<br/>resultado." },
  "ff-hero-sub":   { id: "ff-hero-sub",   type: "paragraph", content: "Mountain bike, trail y running. Galerías el mismo día, con búsqueda por dorsal y por cara." },
  "ff-hero-meta":  { id: "ff-hero-meta",  type: "paragraph", content: "{ubicacion}" },

  /* Tira */
  "ff-work-label": { id: "ff-work-label", type: "paragraph", content: "Trabajo" },

  /* Cifras */
  "ff-cifras-label": { id: "ff-cifras-label", type: "paragraph", content: "En números" },
  "ff-cifras-text":  { id: "ff-cifras-text",  type: "paragraph", content: "Parado en el mismo lugar que nadie quiere: el vadeo helado, la última subida, los diez metros antes de la meta." },
  "ff-stat-1-value": { id: "ff-stat-1-value", type: "paragraph", content: "{eventos}" },
  "ff-stat-1-label": { id: "ff-stat-1-label", type: "paragraph", content: "eventos cubiertos" },
  "ff-stat-2-value": { id: "ff-stat-2-value", type: "paragraph", content: "{fotos}" },
  "ff-stat-2-label": { id: "ff-stat-2-label", type: "paragraph", content: "fotos encontradas por su atleta" },
  "ff-stat-3-value": { id: "ff-stat-3-value", type: "paragraph", content: "{temporadas}" },
  "ff-stat-3-label": { id: "ff-stat-3-label", type: "paragraph", content: "temporadas en la ruta" },

  /* Serie destacada */
  "ff-serie-label": { id: "ff-serie-label", type: "paragraph", content: "Serie destacada" },

  /* Índice de eventos */
  "ff-index-label": { id: "ff-index-label", type: "paragraph", content: "Índice de eventos" },
  "ff-index-intro": { id: "ff-index-intro", type: "paragraph", content: "Cada evento abre su galería en encontrate: buscá tu dorsal o subí una selfie." },

  /* Sobre mí */
  "ff-about-label": { id: "ff-about-label", type: "paragraph", content: "Sobre mí" },
  "ff-about-image": { id: "ff-about-image", type: "image",     src: "", alt: "Retrato" },
  "ff-about-lead":  { id: "ff-about-lead",  type: "paragraph", content: "Empecé sacándole fotos a mis amigos en las carreras del pueblo y nunca bajé la cámara." },
  "ff-about-body":  { id: "ff-about-body",  type: "paragraph", content: "Trabajo con organizadores de mountain bike, trail y running. Llego antes de la largada, elijo el punto donde la carrera se pone difícil y me quedo hasta el último corredor. Cada foto se sube con búsqueda por dorsal y por cara, así cada atleta encuentra la suya." },

  /* Contacto */
  "ff-contact-label":   { id: "ff-contact-label",   type: "paragraph", content: "Contacto" },
  "ff-contact-heading": { id: "ff-contact-heading", type: "heading",   content: "¿Tu próxima<br/>carrera?" },
  "ff-contact-body":    { id: "ff-contact-body",    type: "paragraph", content: "Contame la fecha, el lugar y cuántos corredores esperás. Respondo en el día." },

  /* Pie */
  "ff-footer-copy": { id: "ff-footer-copy", type: "paragraph", content: "© 2026 {nombre}" },
};

export const FOTOFINISH_SECTIONS: SectionDef[] = [
  { id: "section-nav", label: "Navegación", icon: <IconoNav />, locked: true,
    elements: [
      { nodeId: "ff-nav-brand",  label: "Logo",      type: "text" },
      { nodeId: "ff-nav-sub",    label: "Bajada",    type: "text" },
      { nodeId: "ff-nav-estado", label: "Estado",    type: "text" },
    ] },
  { id: "ff-hero", label: "Portada", icon: <IconoPortada />, locked: false,
    elements: [
      { nodeId: "ff-hero-title", label: "Título",         type: "text" },
      { nodeId: "ff-hero-sub",   label: "Bajada",         type: "text" },
      { nodeId: "ff-hero-meta",  label: "Línea de datos", type: "text" },
    ] },
  { id: "ff-work", label: "Tira de fotos", icon: <IconoGrilla />, locked: false,
    elements: [
      { nodeId: "ff-work-label", label: "Rótulo", type: "text" },
    ] },
  { id: "ff-cifras", label: "En números", icon: <IconoCifras />, locked: false,
    elements: [
      { nodeId: "ff-cifras-label", label: "Rótulo",           type: "text" },
      { nodeId: "ff-cifras-text",  label: "Texto",            type: "text" },
      { nodeId: "ff-stat-1-value", label: "Cifra 1 — valor",  type: "text" },
      { nodeId: "ff-stat-1-label", label: "Cifra 1 — rótulo", type: "text" },
      { nodeId: "ff-stat-2-value", label: "Cifra 2 — valor",  type: "text" },
      { nodeId: "ff-stat-2-label", label: "Cifra 2 — rótulo", type: "text" },
      { nodeId: "ff-stat-3-value", label: "Cifra 3 — valor",  type: "text" },
      { nodeId: "ff-stat-3-label", label: "Cifra 3 — rótulo", type: "text" },
    ] },
  { id: "ff-serie", label: "Serie destacada", icon: <IconoPortada />, locked: false,
    elements: [
      { nodeId: "ff-serie-label", label: "Rótulo", type: "text" },
    ] },
  { id: "ff-index", label: "Índice de eventos", icon: <IconoLista />, locked: false,
    elements: [
      { nodeId: "ff-index-label", label: "Rótulo", type: "text" },
      { nodeId: "ff-index-intro", label: "Texto",  type: "text" },
    ] },
  { id: "ff-about", label: "Sobre mí", icon: <IconoPersona />, locked: false,
    elements: [
      { nodeId: "ff-about-label", label: "Rótulo",  type: "text" },
      { nodeId: "ff-about-image", label: "Retrato", type: "image" },
      { nodeId: "ff-about-lead",  label: "Entrada", type: "text" },
      { nodeId: "ff-about-body",  label: "Texto",   type: "text" },
    ] },
  { id: "ff-contact", label: "Contacto", icon: <IconoMail />, locked: false,
    elements: [
      { nodeId: "ff-contact-label",   label: "Rótulo", type: "text" },
      { nodeId: "ff-contact-heading", label: "Título", type: "text" },
      { nodeId: "ff-contact-body",    label: "Texto",  type: "text" },
    ] },
  { id: "section-footer", label: "Pie", icon: <IconoPie />, locked: true,
    elements: [
      { nodeId: "ff-footer-copy", label: "Derechos", type: "text" },
    ] },
];
