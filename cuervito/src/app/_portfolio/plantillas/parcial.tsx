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
 * Parcial: planilla de cronometraje. Casi blanco, tinta, naranja señal y
 * Geist para todo. Las cifras salen de encontrate ({eventos}, {fotos},
 * {temporadas}); si una da cero, se oculta.
 */
export const PARCIAL_NODES: Record<string, EditorNode> = {
  /* Nav */
  "pc-nav-brand":  { id: "pc-nav-brand",  type: "logo",      content: "{nombre}" },
  "pc-nav-estado": { id: "pc-nav-estado", type: "paragraph", content: "Disponible para la temporada" },

  /* Portada */
  "pc-hero-image":   { id: "pc-hero-image",   type: "image",     src: "", alt: "Foto de portada" },
  "pc-hero-eyebrow": { id: "pc-hero-eyebrow", type: "paragraph", content: "Fotografía deportiva" },
  "pc-hero-title":   { id: "pc-hero-title",   type: "heading",   content: "Cada parcial,<br/>cada llegada." },
  "pc-hero-sub":     { id: "pc-hero-sub",     type: "paragraph", content: "Running, trail y ciclismo. Galerías el mismo día, con búsqueda por dorsal y por cara." },
  "pc-hero-meta":    { id: "pc-hero-meta",    type: "paragraph", content: "{ubicacion}" },

  /* Parciales */
  "pc-splits-num": { id: "pc-splits-num", type: "paragraph", content: "01" },
  "pc-splits-label": { id: "pc-splits-label", type: "paragraph", content: "Parciales" },
  "pc-stat-1-value": { id: "pc-stat-1-value", type: "paragraph", content: "{eventos}" },
  "pc-stat-1-label": { id: "pc-stat-1-label", type: "paragraph", content: "eventos cubiertos" },
  "pc-stat-2-value": { id: "pc-stat-2-value", type: "paragraph", content: "{fotos}" },
  "pc-stat-2-label": { id: "pc-stat-2-label", type: "paragraph", content: "fotos encontradas por su atleta" },
  "pc-stat-3-value": { id: "pc-stat-3-value", type: "paragraph", content: "{temporadas}" },
  "pc-stat-3-label": { id: "pc-stat-3-label", type: "paragraph", content: "temporadas en la ruta" },

  /* Trabajo */
  "pc-work-num": { id: "pc-work-num", type: "paragraph", content: "02" },
  "pc-work-label": { id: "pc-work-label", type: "paragraph", content: "Trabajo" },
  "pc-work-title": { id: "pc-work-title", type: "heading",   content: "Lo último que pasó<br/>frente a la cámara." },

  /* Planilla de eventos */
  "pc-events-num": { id: "pc-events-num", type: "paragraph", content: "03" },
  "pc-events-label": { id: "pc-events-label", type: "paragraph", content: "Planilla de eventos" },
  "pc-events-intro": { id: "pc-events-intro", type: "paragraph", content: "Cada fila abre la galería del evento en encontrate: buscá tu dorsal o subí una selfie." },

  /* Sobre mí */
  "pc-about-num": { id: "pc-about-num", type: "paragraph", content: "04" },
  "pc-about-label": { id: "pc-about-label", type: "paragraph", content: "Sobre mí" },
  "pc-about-image": { id: "pc-about-image", type: "image",     src: "", alt: "Retrato" },
  "pc-about-lead":  { id: "pc-about-lead",  type: "paragraph", content: "Llego antes de la largada y me voy con el último corredor." },
  "pc-about-body":  { id: "pc-about-body",  type: "paragraph", content: "Trabajo con organizadores de running, trail y ciclismo. Elijo el punto donde la carrera se pone difícil, y cada foto se sube con búsqueda por dorsal y por cara para que cada atleta encuentre la suya." },

  /* Contacto */
  "pc-contact-num": { id: "pc-contact-num", type: "paragraph", content: "05" },
  "pc-contact-label":   { id: "pc-contact-label",   type: "paragraph", content: "Contacto" },
  "pc-contact-heading": { id: "pc-contact-heading", type: "heading",   content: "¿Largás<br/>pronto?" },
  "pc-contact-body":    { id: "pc-contact-body",    type: "paragraph", content: "Contame la fecha, el lugar y cuántos corredores esperás. Respondo en el día." },

  /* Pie */
  "pc-footer-copy": { id: "pc-footer-copy", type: "paragraph", content: "© 2026 {nombre}" },
};

export const PARCIAL_SECTIONS: SectionDef[] = [
  { id: "section-nav", label: "Navegación", icon: <IconoNav />, locked: true,
    elements: [
      { nodeId: "pc-nav-brand",  label: "Logo",   type: "text" },
      { nodeId: "pc-nav-estado", label: "Estado", type: "text" },
    ] },
  { id: "pc-hero", label: "Portada", icon: <IconoPortada />, locked: false,
    elements: [
      { nodeId: "pc-hero-image",   label: "Foto",           type: "image" },
      { nodeId: "pc-hero-eyebrow", label: "Volanta",        type: "text" },
      { nodeId: "pc-hero-title",   label: "Título",         type: "text" },
      { nodeId: "pc-hero-sub",     label: "Bajada",         type: "text" },
      { nodeId: "pc-hero-meta",    label: "Línea de datos", type: "text" },
    ] },
  { id: "pc-splits", label: "Parciales", icon: <IconoCifras />, locked: false,
    elements: [
      { nodeId: "pc-splits-num", label: "Número", type: "text" },
      { nodeId: "pc-splits-label", label: "Rótulo",           type: "text" },
      { nodeId: "pc-stat-1-value", label: "Cifra 1 — valor",  type: "text" },
      { nodeId: "pc-stat-1-label", label: "Cifra 1 — rótulo", type: "text" },
      { nodeId: "pc-stat-2-value", label: "Cifra 2 — valor",  type: "text" },
      { nodeId: "pc-stat-2-label", label: "Cifra 2 — rótulo", type: "text" },
      { nodeId: "pc-stat-3-value", label: "Cifra 3 — valor",  type: "text" },
      { nodeId: "pc-stat-3-label", label: "Cifra 3 — rótulo", type: "text" },
    ] },
  { id: "pc-work", label: "Trabajo", icon: <IconoGrilla />, locked: false,
    elements: [
      { nodeId: "pc-work-num", label: "Número", type: "text" },
      { nodeId: "pc-work-label", label: "Rótulo", type: "text" },
      { nodeId: "pc-work-title", label: "Título", type: "text" },
    ] },
  { id: "pc-events", label: "Planilla de eventos", icon: <IconoLista />, locked: false,
    elements: [
      { nodeId: "pc-events-num", label: "Número", type: "text" },
      { nodeId: "pc-events-label", label: "Rótulo", type: "text" },
      { nodeId: "pc-events-intro", label: "Texto",  type: "text" },
    ] },
  { id: "pc-about", label: "Sobre mí", icon: <IconoPersona />, locked: false,
    elements: [
      { nodeId: "pc-about-num", label: "Número", type: "text" },
      { nodeId: "pc-about-label", label: "Rótulo",  type: "text" },
      { nodeId: "pc-about-image", label: "Retrato", type: "image" },
      { nodeId: "pc-about-lead",  label: "Entrada", type: "text" },
      { nodeId: "pc-about-body",  label: "Texto",   type: "text" },
    ] },
  { id: "pc-contact", label: "Contacto", icon: <IconoMail />, locked: false,
    elements: [
      { nodeId: "pc-contact-num", label: "Número", type: "text" },
      { nodeId: "pc-contact-label",   label: "Rótulo", type: "text" },
      { nodeId: "pc-contact-heading", label: "Título", type: "text" },
      { nodeId: "pc-contact-body",    label: "Texto",  type: "text" },
    ] },
  { id: "section-footer", label: "Pie", icon: <IconoPie />, locked: true,
    elements: [
      { nodeId: "pc-footer-copy", label: "Derechos", type: "text" },
    ] },
];
