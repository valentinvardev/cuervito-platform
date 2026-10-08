import type { EditorNode } from "../tipos";
import type { SectionDef } from "./tipos";

/* ─── Icons ─── */
function NavIcon()    { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M3 12h18M3 6h18M3 18h18"/></svg>; }
function HeroIcon()   { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><rect x="3" y="3" width="18" height="10" rx="1"/><path d="M3 17h18M7 21h10"/></svg>; }
function GridIcon()   { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>; }
function StarIcon()   { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3 7 7 .5-5.5 4.5 2 7-6.5-4-6.5 4 2-7L2 9.5 9 9z"/></svg>; }
function UserIcon()   { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>; }
function MailIcon()   { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-8.97 5.7a1.94 1.94 0 01-2.06 0L2 7"/></svg>; }
function FooterIcon() { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M3 7h18M3 12h18M3 17h8"/></svg>; }

export const HALCYON_NODES: Record<string, EditorNode> = {
  /* Nav wordmark */
  "hl-mark-name":      { id: "hl-mark-name",      type: "logo",      content: "{nombre}" },
  "hl-mark-sub":       { id: "hl-mark-sub",       type: "paragraph", content: "Fotografía deportiva · Córdoba" },

  /* Cover */
  "hl-cover-image":    { id: "hl-cover-image",    type: "image",     src: "", alt: "" },
  "hl-cover-title":    { id: "hl-cover-title",    type: "heading",   content: "El último kilómetro<br/><em>también se corre.</em>" },

  /* Selected work */
  "hl-work-label":     { id: "hl-work-label",     type: "paragraph", content: "Trabajo" },
  "hl-viewall":        { id: "hl-viewall",        type: "paragraph", content: "Ver todas las fotos" },

  /* Archive banner */
  "hl-archive-eyebrow": { id: "hl-archive-eyebrow", type: "paragraph", content: "El archivo completo" },
  "hl-archive-title":   { id: "hl-archive-title",   type: "heading",   content: "Cada <em>carrera,</em><br/>en un solo lugar." },
  "hl-archive-sub":     { id: "hl-archive-sub",     type: "paragraph", content: "Maratones, trails y nocturnas, juntas. Abrí el archivo y recorrelo a tu ritmo." },
  "hl-archive-cta":     { id: "hl-archive-cta",     type: "paragraph", content: "Abrir el archivo" },

  /* About */
  "hl-about-label":    { id: "hl-about-label",    type: "paragraph", content: "Sobre mí" },
  "hl-about-image":    { id: "hl-about-image",    type: "image",     src: "", alt: "Retrato" },
  "hl-about-heading":  { id: "hl-about-heading",  type: "heading",   content: "Fotos para <em>quedarse,</em><br/>no para pasar de largo." },
  "hl-about-bio":      { id: "hl-about-bio",      type: "paragraph", content: "Fotografío carreras desde la línea, no desde la tribuna. Cubro maratones, trails y competencias de ciclismo, y trabajo con organizadores, clubes y marcas que quieren fotos que se sientan como el día." },
  "hl-about-cta":      { id: "hl-about-cta",      type: "paragraph", content: "Contacto" },

  /* Contact */
  "hl-contact-eyebrow": { id: "hl-contact-eyebrow", type: "paragraph", content: "Agenda abierta para la temporada" },
  "hl-contact-heading": { id: "hl-contact-heading", type: "heading",   content: "Hablemos de <em>tu evento.</em>" },
  "hl-contact-tag":     { id: "hl-contact-tag",     type: "paragraph", content: "Contame la fecha, el lugar y cuántos corredores esperan. Te respondo en el día." },

  /* Footer */
  "hl-footer-mark":    { id: "hl-footer-mark",    type: "logo",      content: "{nombre}" },
  "hl-footer-copy":    { id: "hl-footer-copy",    type: "paragraph", content: "© 2026 · Todas las fotos tienen derechos reservados" },
};

export const HALCYON_SECTIONS: SectionDef[] = [
  { id: "section-nav", label: "Navegación", icon: <NavIcon />, locked: true,
    elements: [
      { nodeId: "hl-mark-name", label: "Nombre",  type: "text" },
      { nodeId: "hl-mark-sub",  label: "Bajada",  type: "text" },
    ] },
  { id: "hl-cover", label: "Portada", icon: <HeroIcon />, locked: false,
    elements: [
      { nodeId: "hl-cover-image", label: "Foto de portada", type: "image" },
      { nodeId: "hl-cover-title", label: "Título",       type: "text"  },
    ] },
  { id: "hl-work", label: "Trabajo", icon: <GridIcon />, locked: false,
    elements: [
      { nodeId: "hl-work-label", label: "Rótulo",    type: "text" },
      { nodeId: "hl-viewall",    label: "Botón ver todo",  type: "text" },
    ] },
  { id: "hl-archive", label: "Archivo", icon: <StarIcon />, locked: false,
    elements: [
      { nodeId: "hl-archive-eyebrow", label: "Antetítulo",  type: "text" },
      { nodeId: "hl-archive-title",   label: "Título",  type: "text" },
      { nodeId: "hl-archive-sub",     label: "Bajada", type: "text" },
      { nodeId: "hl-archive-cta",     label: "Botón",   type: "text" },
    ] },
  { id: "hl-about", label: "Sobre mí", icon: <UserIcon />, locked: false,
    elements: [
      { nodeId: "hl-about-label",   label: "Rótulo", type: "text"  },
      { nodeId: "hl-about-image",   label: "Retrato",      type: "image" },
      { nodeId: "hl-about-heading", label: "Título",       type: "text"  },
      { nodeId: "hl-about-bio",     label: "Bio",           type: "text"  },
      { nodeId: "hl-about-cta",     label: "Botón de contacto", type: "text" },
    ] },
  { id: "contact", label: "Contacto", icon: <MailIcon />, locked: false,
    elements: [
      { nodeId: "hl-contact-eyebrow", label: "Antetítulo",  type: "text" },
      { nodeId: "hl-contact-heading", label: "Título",  type: "text" },
      { nodeId: "hl-contact-tag",     label: "Bajada",  type: "text" },
    ] },
  { id: "section-footer", label: "Pie", icon: <FooterIcon />, locked: true,
    elements: [
      { nodeId: "hl-footer-mark", label: "Nombre",  type: "text" },
      { nodeId: "hl-footer-copy", label: "Derechos", type: "text" },
    ] },
];
