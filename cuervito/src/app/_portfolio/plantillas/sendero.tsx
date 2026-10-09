import type { EditorNode } from "../tipos";
import {
  IconoCita,
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
 * Sendero: crónica de montaña. Hueso, roca y verde verdín; Fraunces con
 * itálicas e Inter Tight. Las fotos van en arcos y tarjetas redondeadas, y
 * los eventos, como un cuaderno de ruta. El sello de la portada sale de
 * {eventos}: si da cero, no aparece.
 *
 * Los rótulos de sección («Crónicas», «Sobre mí») son también los textos del
 * menú; el número romano lo pone la plantilla.
 */
export const SENDERO_NODES: Record<string, EditorNode> = {
  /* Nav */
  "sd-nav-brand":    { id: "sd-nav-brand",    type: "logo",      content: "{nombre}" },

  /* Portada (las imágenes en este orden: portada, cita, retrato, detalle) */
  "sd-hero-image":   { id: "sd-hero-image",   type: "image",     src: "", alt: "" },
  "sd-hero-chip":    { id: "sd-hero-chip",    type: "paragraph", content: "Fotografía de montaña" },
  "sd-hero-meta":    { id: "sd-hero-meta",    type: "paragraph", content: "{ubicacion}" },
  "sd-hero-title":   { id: "sd-hero-title",   type: "heading",   content: "Lo que pasa entre la largada y la <em>meta.</em>" },
  "sd-hero-sub":     { id: "sd-hero-sub",     type: "paragraph", content: "Crónicas de carreras de montaña contadas en fotos: el barro, el río, la cara de quien llega." },
  "sd-hero-cta":     { id: "sd-hero-cta",     type: "paragraph", content: "Ver las crónicas ↓" },
  "sd-sello-value":  { id: "sd-sello-value",  type: "paragraph", content: "{eventos}" },
  "sd-sello-label":  { id: "sd-sello-label",  type: "paragraph", content: "carreras cubiertas" },

  /* Crónicas */
  "sd-cron-label":   { id: "sd-cron-label",   type: "paragraph", content: "Crónicas" },
  "sd-cron-heading": { id: "sd-cron-heading", type: "heading",   content: "Tres carreras, <em>tres historias.</em>" },
  "sd-cron-intro":   { id: "sd-cron-intro",   type: "paragraph", content: "Cada crónica junta las mejores fotos de un evento en el orden en que pasó: de la largada a la última llegada." },

  /* Cita */
  "sd-cita-image":   { id: "sd-cita-image",   type: "image",     src: "", alt: "" },
  "sd-cita-text":    { id: "sd-cita-text",    type: "heading",   content: "“En el río nadie posa. Ahí aparece la cara de verdad.”" },
  "sd-cita-caption": { id: "sd-cita-caption", type: "paragraph", content: "{ubicacion}" },

  /* Cuaderno de ruta */
  "sd-ruta-label":   { id: "sd-ruta-label",   type: "paragraph", content: "Cuaderno de ruta" },
  "sd-ruta-heading": { id: "sd-ruta-heading", type: "heading",   content: "Todas las carreras, <em>una por una.</em>" },
  "sd-ruta-intro":   { id: "sd-ruta-intro",   type: "paragraph", content: "Tocá un evento para ver su galería completa y buscar tus fotos por dorsal o con una selfie." },

  /* Sobre mí */
  "sd-about-label":   { id: "sd-about-label",   type: "paragraph", content: "Sobre mí" },
  "sd-about-image":   { id: "sd-about-image",   type: "image",     src: "", alt: "Retrato" },
  "sd-about-image-2": { id: "sd-about-image-2", type: "image",     src: "", alt: "" },
  "sd-about-heading": { id: "sd-about-heading", type: "heading",   content: "Con los pies en el río y la cámara seca." },
  "sd-about-body":    { id: "sd-about-body",    type: "paragraph", content: "Trabajo con organizadores de carreras de montaña. Llego antes de la largada, elijo el punto donde la carrera se pone difícil y me quedo hasta el último corredor. Las fotos se suben el mismo día, y cada atleta encuentra las suyas con su dorsal o una selfie." },

  /* Contacto */
  "sd-contact-label":   { id: "sd-contact-label",   type: "paragraph", content: "Contacto" },
  "sd-contact-heading": { id: "sd-contact-heading", type: "heading",   content: "Escribime y <em>vamos</em> a tu carrera." },
  "sd-contact-body":    { id: "sd-contact-body",    type: "paragraph", content: "Contame la fecha, el lugar y cuántos corredores esperás. Respondo en el día." },

  /* Pie */
  "sd-footer-brand": { id: "sd-footer-brand", type: "logo",      content: "{nombre}" },
  "sd-footer-copy":  { id: "sd-footer-copy",  type: "paragraph", content: "© 2026 · Todas las fotos tienen derechos reservados" },
};

export const SENDERO_SECTIONS: SectionDef[] = [
  { id: "section-nav", label: "Navegación", icon: <IconoNav />, locked: true,
    elements: [
      { nodeId: "sd-nav-brand", label: "Logo", type: "text" },
    ] },
  { id: "sd-hero", label: "Portada", icon: <IconoPortada />, locked: false,
    elements: [
      { nodeId: "sd-hero-image",  label: "Foto en arco",   type: "image" },
      { nodeId: "sd-hero-chip",   label: "Etiqueta",       type: "text" },
      { nodeId: "sd-hero-meta",   label: "Línea de datos", type: "text" },
      { nodeId: "sd-hero-title",  label: "Título",         type: "text" },
      { nodeId: "sd-hero-sub",    label: "Bajada",         type: "text" },
      { nodeId: "sd-hero-cta",    label: "Botón",          type: "text" },
      { nodeId: "sd-sello-value", label: "Sello — cifra",  type: "text" },
      { nodeId: "sd-sello-label", label: "Sello — rótulo", type: "text" },
    ] },
  { id: "sd-cronicas", label: "Crónicas", icon: <IconoGrilla />, locked: false,
    elements: [
      { nodeId: "sd-cron-label",   label: "Rótulo (y menú)", type: "text" },
      { nodeId: "sd-cron-heading", label: "Título",          type: "text" },
      { nodeId: "sd-cron-intro",   label: "Texto",           type: "text" },
    ] },
  { id: "sd-cita", label: "Cita", icon: <IconoCita />, locked: false,
    elements: [
      { nodeId: "sd-cita-image",   label: "Foto",     type: "image" },
      { nodeId: "sd-cita-text",    label: "Cita",     type: "text" },
      { nodeId: "sd-cita-caption", label: "Epígrafe", type: "text" },
    ] },
  { id: "sd-ruta", label: "Cuaderno de ruta", icon: <IconoLista />, locked: false,
    elements: [
      { nodeId: "sd-ruta-label",   label: "Rótulo (y menú)", type: "text" },
      { nodeId: "sd-ruta-heading", label: "Título",          type: "text" },
      { nodeId: "sd-ruta-intro",   label: "Texto",           type: "text" },
    ] },
  { id: "sd-about", label: "Sobre mí", icon: <IconoPersona />, locked: false,
    elements: [
      { nodeId: "sd-about-label",   label: "Rótulo (y menú)", type: "text" },
      { nodeId: "sd-about-image",   label: "Retrato",         type: "image" },
      { nodeId: "sd-about-image-2", label: "Foto chica",      type: "image" },
      { nodeId: "sd-about-heading", label: "Título",          type: "text" },
      { nodeId: "sd-about-body",    label: "Bio",             type: "text" },
    ] },
  { id: "sd-contact", label: "Contacto", icon: <IconoMail />, locked: false,
    elements: [
      { nodeId: "sd-contact-label",   label: "Rótulo (y menú)", type: "text" },
      { nodeId: "sd-contact-heading", label: "Título",          type: "text" },
      { nodeId: "sd-contact-body",    label: "Texto",           type: "text" },
    ] },
  { id: "section-footer", label: "Pie", icon: <IconoPie />, locked: true,
    elements: [
      { nodeId: "sd-footer-brand", label: "Nombre",   type: "text" },
      { nodeId: "sd-footer-copy",  label: "Derechos", type: "text" },
    ] },
];
