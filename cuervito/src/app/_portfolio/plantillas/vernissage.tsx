import type { EditorNode } from "../tipos";
import type { SectionDef } from "./tipos";

/* ─── Icons ─── */
function NavIcon()    { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M3 12h18M3 6h18M3 18h18"/></svg>; }
function HeroIcon()   { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><rect x="3" y="3" width="18" height="10" rx="1"/><path d="M3 17h18M7 21h10"/></svg>; }
function CubeIcon()   { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12"/></svg>; }
function UserIcon()   { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>; }
function MailIcon()   { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-8.97 5.7a1.94 1.94 0 01-2.06 0L2 7"/></svg>; }
function FooterIcon() { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M3 7h18M3 12h18M3 17h8"/></svg>; }

export const VERNISSAGE_NODES: Record<string, EditorNode> = {
  /* Nav */
  "vrn-nav-brand":     { id: "vrn-nav-brand",     type: "logo",      content: "{nombre}" },
  "vrn-nav-item-1":    { id: "vrn-nav-item-1",    type: "paragraph", content: "Muestra" },
  "vrn-nav-item-2":    { id: "vrn-nav-item-2",    type: "paragraph", content: "Sobre mí" },
  "vrn-nav-item-3":    { id: "vrn-nav-item-3",    type: "paragraph", content: "Contacto" },
  "vrn-nav-cta":       { id: "vrn-nav-cta",       type: "paragraph", content: "Escribime" },

  /* Hero — exhibition poster */
  "vrn-hero-eyebrow":  { id: "vrn-hero-eyebrow",  type: "paragraph", content: "Muestra · Temporada 2026" },
  "vrn-hero-title":    { id: "vrn-hero-title",    type: "heading",   content: "Línea de<br/><em>llegada</em>" },
  "vrn-hero-dates":    { id: "vrn-hero-dates",    type: "paragraph", content: "Maratones · Trails · Nocturnas" },
  "vrn-hero-sub":      { id: "vrn-hero-sub",      type: "paragraph", content: "Las mejores fotos de la temporada, una por una. Pasalas y dejá que cada una ocupe la pared." },
  "vrn-hero-cta":      { id: "vrn-hero-cta",      type: "paragraph", content: "Entrar a la muestra" },

  /* Gallery (3D showcase) */
  "vrn-gallery-label": { id: "vrn-gallery-label", type: "paragraph", content: "La muestra" },
  "vrn-gallery-note":  { id: "vrn-gallery-note",  type: "paragraph", content: "Deslizá o usá las flechas. Tocá la foto del frente para verla en grande." },
  "vrn-endwall-title": { id: "vrn-endwall-title", type: "heading",   content: "La temporada<br/><em>sigue.</em>" },
  "vrn-endwall-cta":   { id: "vrn-endwall-cta",   type: "paragraph", content: "Ver todas las fotos" },

  /* About */
  "vrn-about-label":   { id: "vrn-about-label",   type: "paragraph", content: "Sobre mí" },
  "vrn-about-image":   { id: "vrn-about-image",   type: "image",     src: "", alt: "Retrato" },
  "vrn-about-heading": { id: "vrn-about-heading", type: "heading",   content: "Cada carrera<br/><em>es una historia.</em>" },
  "vrn-about-body":    { id: "vrn-about-body",    type: "paragraph", content: "No subo todo lo que saco: elijo. Cada cobertura tiene una largada, un kilómetro largo en el medio y una llegada que te llevás a casa." },
  "vrn-stat-1-value":  { id: "vrn-stat-1-value",  type: "paragraph", content: "{temporadas}" },
  "vrn-stat-1-label":  { id: "vrn-stat-1-label",  type: "paragraph", content: "Temporadas" },
  "vrn-stat-2-value":  { id: "vrn-stat-2-value",  type: "paragraph", content: "{eventos}" },
  "vrn-stat-2-label":  { id: "vrn-stat-2-label",  type: "paragraph", content: "Eventos cubiertos" },
  "vrn-stat-3-value":  { id: "vrn-stat-3-value",  type: "paragraph", content: "{fotos}" },
  "vrn-stat-3-label":  { id: "vrn-stat-3-label",  type: "paragraph", content: "Fotos vendidas" },

  /* Contact */
  "vrn-contact-label":    { id: "vrn-contact-label",    type: "paragraph", content: "Contacto" },
  "vrn-contact-heading":  { id: "vrn-contact-heading",  type: "heading",   content: "Contame<br/><em>tu evento.</em>" },
  "vrn-contact-body":     { id: "vrn-contact-body",     type: "paragraph", content: "Coberturas, sesiones de equipo y fotos para marcas. La fecha, el lugar y cuántos corredores esperan." },
  "vrn-contact-d1-label": { id: "vrn-contact-d1-label", type: "paragraph", content: "Instagram" },
  "vrn-contact-d1-value": { id: "vrn-contact-d1-value", type: "paragraph", content: "{instagram}" },
  "vrn-contact-d2-label": { id: "vrn-contact-d2-label", type: "paragraph", content: "Web" },
  "vrn-contact-d2-value": { id: "vrn-contact-d2-value", type: "paragraph", content: "{web}" },
  "vrn-contact-d3-label": { id: "vrn-contact-d3-label", type: "paragraph", content: "Zona" },
  "vrn-contact-d3-value": { id: "vrn-contact-d3-value", type: "paragraph", content: "{ubicacion}" },

  /* Footer */
  "vrn-footer-brand":  { id: "vrn-footer-brand",  type: "logo",      content: "{nombre}" },
  "vrn-footer-copy":   { id: "vrn-footer-copy",   type: "paragraph", content: "© 2026 · Todas las fotos tienen derechos reservados" },
};

export const VERNISSAGE_SECTIONS: SectionDef[] = [
  { id: "section-nav", label: "Navegación", icon: <NavIcon />, locked: true,
    elements: [
      { nodeId: "vrn-nav-brand",  label: "Logo",   type: "text" },
      { nodeId: "vrn-nav-item-1", label: "Enlace 1", type: "text" },
      { nodeId: "vrn-nav-item-2", label: "Enlace 2", type: "text" },
      { nodeId: "vrn-nav-item-3", label: "Enlace 3", type: "text" },
      { nodeId: "vrn-nav-cta",    label: "Botón", type: "text" },
    ] },
  { id: "vrn-hero", label: "Portada", icon: <HeroIcon />, locked: false,
    elements: [
      { nodeId: "vrn-hero-eyebrow", label: "Antetítulo",  type: "text" },
      { nodeId: "vrn-hero-title",   label: "Título",    type: "text" },
      { nodeId: "vrn-hero-dates",   label: "Fechas",    type: "text" },
      { nodeId: "vrn-hero-sub",     label: "Texto", type: "text" },
      { nodeId: "vrn-hero-cta",     label: "Botón",   type: "text" },
    ] },
  { id: "vrn-gallery", label: "Muestra 3D", icon: <CubeIcon />, locked: false,
    elements: [
      { nodeId: "vrn-gallery-label", label: "Rótulo",   type: "text" },
      { nodeId: "vrn-gallery-note",  label: "Texto de pared",       type: "text" },
      { nodeId: "vrn-endwall-title", label: "Cierre — título", type: "text" },
      { nodeId: "vrn-endwall-cta",   label: "Cierre — botón", type: "text" },
    ] },
  { id: "vrn-about", label: "Sobre mí", icon: <UserIcon />, locked: false,
    elements: [
      { nodeId: "vrn-about-label",   label: "Rótulo", type: "text"  },
      { nodeId: "vrn-about-image",   label: "Retrato",      type: "image" },
      { nodeId: "vrn-about-heading", label: "Título",       type: "text"  },
      { nodeId: "vrn-about-body",    label: "Bio",           type: "text"  },
      { nodeId: "vrn-stat-1-value",  label: "Dato 1 — valor",  type: "text"  },
      { nodeId: "vrn-stat-1-label",  label: "Dato 1 — rótulo",  type: "text"  },
      { nodeId: "vrn-stat-2-value",  label: "Dato 2 — valor",  type: "text"  },
      { nodeId: "vrn-stat-2-label",  label: "Dato 2 — rótulo",  type: "text"  },
      { nodeId: "vrn-stat-3-value",  label: "Dato 3 — valor",  type: "text"  },
      { nodeId: "vrn-stat-3-label",  label: "Dato 3 — rótulo",  type: "text"  },
    ] },
  { id: "vrn-contact", label: "Contacto", icon: <MailIcon />, locked: false,
    elements: [
      { nodeId: "vrn-contact-label",    label: "Rótulo",  type: "text" },
      { nodeId: "vrn-contact-heading",  label: "Título",        type: "text" },
      { nodeId: "vrn-contact-body",     label: "Texto",           type: "text" },
      { nodeId: "vrn-contact-d1-label", label: "Contacto 1 — rótulo", type: "text" },
      { nodeId: "vrn-contact-d1-value", label: "Contacto 1 — valor", type: "text" },
      { nodeId: "vrn-contact-d2-label", label: "Contacto 2 — rótulo", type: "text" },
      { nodeId: "vrn-contact-d2-value", label: "Contacto 2 — valor", type: "text" },
      { nodeId: "vrn-contact-d3-label", label: "Contacto 3 — rótulo", type: "text" },
      { nodeId: "vrn-contact-d3-value", label: "Contacto 3 — valor", type: "text" },
    ] },
  { id: "section-footer", label: "Pie", icon: <FooterIcon />, locked: true,
    elements: [
      { nodeId: "vrn-footer-brand", label: "Logo",      type: "text" },
      { nodeId: "vrn-footer-copy",  label: "Derechos", type: "text" },
    ] },
];
