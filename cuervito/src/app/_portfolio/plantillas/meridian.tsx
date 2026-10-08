import type { EditorNode } from "../tipos";
import type { SectionDef } from "./tipos";

/* ─── Icons ─── */
function NavIcon()    { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M3 12h18M3 6h18M3 18h18"/></svg>; }
function HeroIcon()   { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><rect x="3" y="3" width="18" height="10" rx="1"/><path d="M3 17h18M7 21h10"/></svg>; }
function GridIcon()   { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>; }
function ListIcon()   { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>; }
function UserIcon()   { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>; }
function MailIcon()   { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-8.97 5.7a1.94 1.94 0 01-2.06 0L2 7"/></svg>; }
function FooterIcon() { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M3 7h18M3 12h18M3 17h8"/></svg>; }

export const MERIDIAN_NODES: Record<string, EditorNode> = {
  /* Nav */
  "mrd-nav-brand":     { id: "mrd-nav-brand",     type: "logo",      content: "{nombre}" },
  "mrd-nav-item-1":    { id: "mrd-nav-item-1",    type: "paragraph", content: "Trabajo" },
  "mrd-nav-item-2":    { id: "mrd-nav-item-2",    type: "paragraph", content: "Sobre mí" },
  "mrd-nav-item-3":    { id: "mrd-nav-item-3",    type: "paragraph", content: "Contacto" },
  "mrd-nav-cta":       { id: "mrd-nav-cta",       type: "paragraph", content: "Pedí una cobertura" },

  /* Hero */
  "mrd-hero-eyebrow":  { id: "mrd-hero-eyebrow",  type: "paragraph", content: "Fotografía deportiva" },
  "mrd-hero-title":    { id: "mrd-hero-title",    type: "heading",   content: "Correr,<br/><em>mirado de cerca.</em>" },
  "mrd-hero-sub":      { id: "mrd-hero-sub",      type: "paragraph", content: "Maratones, trails y competencias, fotografiados con paciencia y desde adentro de la carrera." },
  "mrd-hero-meta":     { id: "mrd-hero-meta",     type: "paragraph", content: "Desde 2018 · Córdoba, Argentina" },
  "mrd-hero-cta-1":    { id: "mrd-hero-cta-1",    type: "paragraph", content: "Ver el trabajo" },
  "mrd-hero-cta-2":    { id: "mrd-hero-cta-2",    type: "paragraph", content: "Sobre mí" },
  "mrd-hero-image":    { id: "mrd-hero-image",    type: "image",     src: "", alt: "" },
  "mrd-hero-caption":  { id: "mrd-hero-caption",  type: "paragraph", content: "Kilómetro 41, a la mañana" },

  /* Work */
  "mrd-work-label":    { id: "mrd-work-label",    type: "paragraph", content: "Selección" },
  "mrd-work-intro":    { id: "mrd-work-intro",    type: "paragraph", content: "Una selección de las últimas coberturas." },

  /* Services */
  "mrd-serv-label":    { id: "mrd-serv-label",    type: "paragraph", content: "Servicios" },
  "mrd-serv-1-title":  { id: "mrd-serv-1-title",  type: "heading",   content: "Cobertura de eventos" },
  "mrd-serv-1-desc":   { id: "mrd-serv-1-desc",   type: "paragraph", content: "Carreras, trails y competencias. Fotos de cada corredor, listas para vender en encontrate." },
  "mrd-serv-2-title":  { id: "mrd-serv-2-title",  type: "heading",   content: "Marcas y clubes" },
  "mrd-serv-2-desc":   { id: "mrd-serv-2-desc",   type: "paragraph", content: "Campañas, equipos y entrenamientos para marcas deportivas y clubes." },
  "mrd-serv-3-title":  { id: "mrd-serv-3-title",  type: "heading",   content: "Sesiones de equipo" },
  "mrd-serv-3-desc":   { id: "mrd-serv-3-desc",   type: "paragraph", content: "Fotos de plantel y retratos antes del torneo, en la cancha o en estudio." },

  /* About */
  "mrd-about-label":   { id: "mrd-about-label",   type: "paragraph", content: "Sobre mí" },
  "mrd-about-image":   { id: "mrd-about-image",   type: "image",     src: "", alt: "Retrato" },
  "mrd-about-heading": { id: "mrd-about-heading", type: "heading",   content: "La luz, la línea<br/>y <em>el último esfuerzo.</em>" },
  "mrd-about-body":    { id: "mrd-about-body",    type: "paragraph", content: "Fotografío carreras desde hace años. Aprendí que la mejor foto no es la de la llegada sino la del kilómetro en el que nadie mira. Trabajo con organizadores, clubes y marcas que quieren contar el día como fue." },
  "mrd-stat-1-value":  { id: "mrd-stat-1-value",  type: "paragraph", content: "8" },
  "mrd-stat-1-label":  { id: "mrd-stat-1-label",  type: "paragraph", content: "Temporadas" },
  "mrd-stat-2-value":  { id: "mrd-stat-2-value",  type: "paragraph", content: "140" },
  "mrd-stat-2-label":  { id: "mrd-stat-2-label",  type: "paragraph", content: "Eventos" },
  "mrd-stat-3-value":  { id: "mrd-stat-3-value",  type: "paragraph", content: "60 mil" },
  "mrd-stat-3-label":  { id: "mrd-stat-3-label",  type: "paragraph", content: "Fotos entregadas" },

  /* Contact */
  "mrd-contact-label":   { id: "mrd-contact-label",   type: "paragraph", content: "Contacto" },
  "mrd-contact-heading": { id: "mrd-contact-heading", type: "heading",   content: "Contame<br/><em>tu evento.</em>" },
  "mrd-contact-body":    { id: "mrd-contact-body",    type: "paragraph", content: "La fecha, el lugar y cuántos corredores esperan. Te respondo en el día." },
  "mrd-contact-d1-label": { id: "mrd-contact-d1-label", type: "paragraph", content: "Email" },
  "mrd-contact-d1-value": { id: "mrd-contact-d1-value", type: "paragraph", content: "hola@tudominio.com" },
  "mrd-contact-d2-label": { id: "mrd-contact-d2-label", type: "paragraph", content: "Teléfono" },
  "mrd-contact-d2-value": { id: "mrd-contact-d2-value", type: "paragraph", content: "+54 9 351 000 0000" },
  "mrd-contact-d3-label": { id: "mrd-contact-d3-label", type: "paragraph", content: "Zona" },
  "mrd-contact-d3-value": { id: "mrd-contact-d3-value", type: "paragraph", content: "Córdoba y alrededores" },

  /* Footer */
  "mrd-footer-brand":  { id: "mrd-footer-brand",  type: "logo",      content: "{nombre}" },
  "mrd-footer-copy":   { id: "mrd-footer-copy",   type: "paragraph", content: "© 2026 · Todas las fotos tienen derechos reservados" },
};

export const MERIDIAN_SECTIONS: SectionDef[] = [
  { id: "section-nav", label: "Navegación", icon: <NavIcon />, locked: true,
    elements: [
      { nodeId: "mrd-nav-brand",  label: "Logo",   type: "text" },
      { nodeId: "mrd-nav-item-1", label: "Enlace 1", type: "text" },
      { nodeId: "mrd-nav-item-2", label: "Enlace 2", type: "text" },
      { nodeId: "mrd-nav-item-3", label: "Enlace 3", type: "text" },
      { nodeId: "mrd-nav-cta",    label: "Botón", type: "text" },
    ] },
  { id: "mrd-hero", label: "Portada", icon: <HeroIcon />, locked: false,
    elements: [
      { nodeId: "mrd-hero-eyebrow", label: "Antetítulo",     type: "text"  },
      { nodeId: "mrd-hero-title",   label: "Título",     type: "text"  },
      { nodeId: "mrd-hero-sub",     label: "Bajada",    type: "text"  },
      { nodeId: "mrd-hero-meta",    label: "Línea de datos",   type: "text"  },
      { nodeId: "mrd-hero-cta-1",   label: "Botón 1",    type: "text"  },
      { nodeId: "mrd-hero-cta-2",   label: "Botón 2",    type: "text"  },
      { nodeId: "mrd-hero-image",   label: "Foto de portada",  type: "image" },
      { nodeId: "mrd-hero-caption", label: "Epígrafe",     type: "text"  },
    ] },
  { id: "mrd-work", label: "Trabajo", icon: <GridIcon />, locked: false,
    elements: [
      { nodeId: "mrd-work-label", label: "Rótulo", type: "text" },
      { nodeId: "mrd-work-intro", label: "Introducción",    type: "text" },
    ] },
  { id: "mrd-services", label: "Servicios", icon: <ListIcon />, locked: false,
    elements: [
      { nodeId: "mrd-serv-label",   label: "Rótulo",   type: "text" },
      { nodeId: "mrd-serv-1-title", label: "Servicio 1 — título", type: "text" },
      { nodeId: "mrd-serv-1-desc",  label: "Servicio 1 — texto", type: "text" },
      { nodeId: "mrd-serv-2-title", label: "Servicio 2 — título", type: "text" },
      { nodeId: "mrd-serv-2-desc",  label: "Servicio 2 — texto", type: "text" },
      { nodeId: "mrd-serv-3-title", label: "Servicio 3 — título", type: "text" },
      { nodeId: "mrd-serv-3-desc",  label: "Servicio 3 — texto", type: "text" },
    ] },
  { id: "mrd-about", label: "Sobre mí", icon: <UserIcon />, locked: false,
    elements: [
      { nodeId: "mrd-about-label",   label: "Rótulo", type: "text"  },
      { nodeId: "mrd-about-image",   label: "Retrato",      type: "image" },
      { nodeId: "mrd-about-heading", label: "Título",       type: "text"  },
      { nodeId: "mrd-about-body",    label: "Bio",           type: "text"  },
      { nodeId: "mrd-stat-1-value",  label: "Dato 1 — valor",  type: "text"  },
      { nodeId: "mrd-stat-1-label",  label: "Dato 1 — rótulo",  type: "text"  },
      { nodeId: "mrd-stat-2-value",  label: "Dato 2 — valor",  type: "text"  },
      { nodeId: "mrd-stat-2-label",  label: "Dato 2 — rótulo",  type: "text"  },
      { nodeId: "mrd-stat-3-value",  label: "Dato 3 — valor",  type: "text"  },
      { nodeId: "mrd-stat-3-label",  label: "Dato 3 — rótulo",  type: "text"  },
    ] },
  { id: "mrd-contact", label: "Contacto", icon: <MailIcon />, locked: false,
    elements: [
      { nodeId: "mrd-contact-label",    label: "Rótulo",  type: "text" },
      { nodeId: "mrd-contact-heading",  label: "Título",        type: "text" },
      { nodeId: "mrd-contact-body",     label: "Texto",           type: "text" },
      { nodeId: "mrd-contact-d1-label", label: "Contacto 1 — rótulo", type: "text" },
      { nodeId: "mrd-contact-d1-value", label: "Contacto 1 — valor", type: "text" },
      { nodeId: "mrd-contact-d2-label", label: "Contacto 2 — rótulo", type: "text" },
      { nodeId: "mrd-contact-d2-value", label: "Contacto 2 — valor", type: "text" },
      { nodeId: "mrd-contact-d3-label", label: "Contacto 3 — rótulo", type: "text" },
      { nodeId: "mrd-contact-d3-value", label: "Contacto 3 — valor", type: "text" },
    ] },
  { id: "section-footer", label: "Pie", icon: <FooterIcon />, locked: true,
    elements: [
      { nodeId: "mrd-footer-brand", label: "Logo",      type: "text" },
      { nodeId: "mrd-footer-copy",  label: "Derechos", type: "text" },
    ] },
];
