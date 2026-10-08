"use client";

/**
 * Halcyon — oscura y editorial, con los eventos del fotógrafo como índice.
 *
 * Viene de photo-saas (components/editor/canvas/HalcyonTemplate.tsx). Lo que
 * cambió al traerla:
 *  - Los proyectos del índice son los grupos del portfolio (un evento cada
 *    uno), no un catálogo de demo.
 *  - Redes, ubicación y nombre salen del perfil del fotógrafo.
 *  - El formulario manda la consulta por la función que pone quien monta el
 *    sitio (store.enviarConsulta), no por tRPC directo.
 *  - Sin framer-motion: los paneles entran con una animación de CSS.
 *  - Todo el texto fijo, en castellano.
 *
 * Cajón, detalle, archivo y visor se montan sólo en el sitio (readOnly): en el
 * editor taparían lo que se está editando.
 */

import { useEffect, useMemo, useState } from "react";
import { useEditorStore } from "../store";
import type { Viewport } from "../tipos";
import { EditableNode, EditableText, EditableImage, LogoImage } from "../primitivas";
import { agruparProyectos } from "../proyectos";
import { campo, fillWaTemplate } from "../whatsapp";

type HlPhoto = { id: string; src: string; title: string; date: string };
type GalleryPhoto = HlPhoto & { projectTitle?: string };
type Lightbox = { photos: GalleryPhoto[]; index: number } | null;

/* Editor-driven design tokens — every colour/font resolves to a Design-panel
   variable, so palette + typography changes apply live. raised/line are derived
   from fg/bg with color-mix so they track the palette too. */
const t = {
  accent: "var(--ed-accent, #C2410C)",
  bg:     "var(--ed-bg, #0E0D0B)",
  raised: "color-mix(in srgb, var(--ed-fg, #EFEAE0) 8%, var(--ed-bg, #0E0D0B))",
  fg:     "var(--ed-fg, #EFEAE0)",
  muted:  "var(--ed-muted, #8A8378)",
  line:   "color-mix(in srgb, var(--ed-fg, #EFEAE0) 16%, transparent)",
};
const HL_FONTS = {
  serif: "var(--tpl-serif), Georgia, serif",
  sans:  "var(--tpl-sans), system-ui, sans-serif",
  mono:  "var(--tpl-mono), ui-monospace, monospace",
};

/* Base rules — reset scoped to .hl-scope so it never touches editor chrome. */
function hlBaseCss() {
  return `
    .hl-scope, .hl-scope *{box-sizing:border-box}
    .hl-scope h1,.hl-scope h2,.hl-scope h3,.hl-scope h4,.hl-scope p,.hl-scope ul,.hl-scope li,.hl-scope figure,.hl-scope blockquote{margin:0;padding:0}
    .hl-scope ul{list-style:none}
    .hl-serif{font-family:${HL_FONTS.serif};font-weight:400;letter-spacing:-0.01em}
    .hl-italic{font-family:${HL_FONTS.serif};font-style:italic;font-weight:400}
    .hl-mono{font-family:${HL_FONTS.mono};font-size:11px;letter-spacing:0.08em;text-transform:uppercase}
    .hl-btn{font-family:${HL_FONTS.mono};font-size:11px;letter-spacing:0.08em;text-transform:uppercase;padding:14px 18px;border:1px solid ${t.line};background:transparent;color:${t.fg};cursor:pointer;transition:all .25s ease;display:inline-flex;align-items:center;gap:10px;text-decoration:none}
    .hl-btn:hover{border-color:${t.fg};background:${t.fg};color:${t.bg}}
    .hl-btn-accent{background:${t.accent};border-color:${t.accent};color:${t.fg}}
    .hl-btn-accent:hover{background:${t.fg};color:${t.bg};border-color:${t.fg}}
    .hl-eyebrow{font-family:${HL_FONTS.mono};font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:${t.muted}}
  `;
}

/* On the live site interactive triggers fire; in the editor a click selects the
   nearest editable node instead (and overlays would block editing). */
function useGuard() {
  const readOnly = useEditorStore((s) => s.readOnly);
  return (fn: () => void) => () => { if (readOnly) fn(); };
}

/* Clickable — real <button>/<a> on the live site, plain <span> in the editor.
   Editable text must never sit inside a real <button> (it hijacks Space/Enter
   and clicking would deselect), so the editor renders a styled span instead. */
function Clickable({
  kind = "button", href, className, onActivate, children,
}: {
  kind?: "button" | "a";
  href?: string;
  className?: string;
  onActivate?: () => void;
  children: React.ReactNode;
}) {
  const readOnly = useEditorStore((s) => s.readOnly);
  if (!readOnly) return <span className={className} style={{ cursor: "default" }}>{children}</span>;
  if (kind === "a") return <a className={className} href={href}>{children}</a>;
  return <button className={className} onClick={onActivate}>{children}</button>;
}

export function HalcyonPlantilla({ viewport }: { viewport: Viewport }) {
  const selectNode      = useEditorStore((s) => s.selectNode);
  const logo            = useEditorStore((s) => s.logo);
  const readOnly        = useEditorStore((s) => s.readOnly);
  const galleryPhotos   = useEditorStore((s) => s.galleryPhotos);
  const grid            = useEditorStore((s) => s.grid);
  const perfil          = useEditorStore((s) => s.perfil);
  const guard = useGuard();
  const proyectos = useMemo(() => agruparProyectos(galleryPhotos), [galleryPhotos]);

  /* Responsive flags from the editor viewport toggle (the photo grids need them;
     the rest of the template still uses CSS media queries). */
  const isMobile = viewport === "mobile";
  const isTablet = viewport === "tablet";

  const [navOpen,       setNavOpen]       = useState(false);
  const [activeProject, setActiveProject] = useState<string | null>(null);
  const [galleryOpen,   setGalleryOpen]   = useState(false);
  const [lightbox,      setLightbox]      = useState<Lightbox>(null);
  const [hoverIdx,      setHoverIdx]      = useState(-1);
  const [drawerHoverId, setDrawerHoverId] = useState<string | null>(null);
  const [showAllWorks,  setShowAllWorks]  = useState(false);

  const VISIBLE_WORKS = 3;
  const visibleProjects = showAllWorks ? proyectos : proyectos.slice(0, VISIBLE_WORKS);
  const hiddenCount     = proyectos.length - VISIBLE_WORKS;

  /* Todas las fotos, para el archivo y el visor. */
  const allPhotos: GalleryPhoto[] = useMemo(
    () => proyectos.flatMap((p) => p.photos.map((ph) => ({ ...ph, projectTitle: p.title }))),
    [proyectos]
  );

  const project       = proyectos.find((p) => p.id === activeProject);
  const detailPhotos: HlPhoto[] = project?.photos ?? [];

  /* Grillas de fotos (mosaico/uniforme/cascada) del panel de Diseño; "index"
     es la lista tipográfica propia de Halcyon. */
  const cols     = isMobile ? Math.min(grid.columns, 2) : isTablet ? Math.min(grid.columns, 3) : grid.columns;
  const featured = allPhotos.slice(0, 8);
  const [visibleCount, setVisibleCount] = useState(grid.pageSize);
  useEffect(() => { setVisibleCount(grid.pageSize); }, [grid.pageSize, grid.loadMore, grid.layout, allPhotos.length]);
  const pagedWorks  = grid.loadMore ? allPhotos.slice(0, visibleCount) : featured;
  const canLoadMore = grid.loadMore && visibleCount < allPhotos.length;
  const openLightbox = (photos: GalleryPhoto[], index: number) => { if (readOnly) setLightbox({ photos, index }); };

  const drawerProject  = drawerHoverId ? proyectos.find((p) => p.id === drawerHoverId) : null;
  const drawerImageSrc = (drawerProject ?? proyectos[0])?.photos[0]?.src ?? null;
  const indexImageSrc  = hoverIdx < 0 ? null : (proyectos[hoverIdx]?.photos[0]?.src ?? null);

  useEffect(() => {
    if (!readOnly) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (lightbox)           setLightbox(null);
        else if (galleryOpen)   setGalleryOpen(false);
        else if (activeProject) setActiveProject(null);
        else if (navOpen)       setNavOpen(false);
      }
      if (lightbox) {
        if (e.key === "ArrowRight") setLightbox((l) => l && ({ ...l, index: (l.index + 1) % l.photos.length }));
        if (e.key === "ArrowLeft")  setLightbox((l) => l && ({ ...l, index: (l.index - 1 + l.photos.length) % l.photos.length }));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [readOnly, lightbox, galleryOpen, activeProject, navOpen]);

  const instagram = perfil.instagram
    ? (perfil.instagram.startsWith("http") ? perfil.instagram : `https://instagram.com/${perfil.instagram.replace(/^@/, "")}`)
    : null;
  const Socials = () => (instagram || perfil.web) ? (
    <div className="hp-socials">
      {instagram && (
        <a href={instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
          </svg>
        </a>
      )}
      {perfil.web && (
        <a href={perfil.web} target="_blank" rel="noopener noreferrer" aria-label="Sitio web">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
        </a>
      )}
    </div>
  ) : null;

  /* Wordmark — supports the Settings > Logo image modes like the other templates. */
  function Brand({ nodeId, className }: { nodeId: string; className?: string }) {
    const textEl = (
      <EditableNode id={nodeId} tag="span" className={className}>
        <EditableText id={nodeId} display="inline" />
      </EditableNode>
    );
    if (logo.mode === "image" && logo.imageUrl) {
      return <LogoImage src={logo.imageUrl} alt={logo.text} width={logo.width} crop={logo.imageCrop} />;
    }
    if (logo.mode === "image+text" && logo.imageUrl) {
      return (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <LogoImage src={logo.imageUrl} width={logo.width} crop={logo.imageCrop} />
          {textEl}
        </span>
      );
    }
    return textEl;
  }

  return (
    <div
      className="hl-scope hl-root"
      data-viewport={viewport}
      onClick={() => selectNode(null)}
      style={{ minHeight: "100%", position: "relative", overflow: "hidden", background: t.bg, color: t.fg, fontFamily: HL_FONTS.sans }}
    >
      <style>{hlBaseCss()}</style>
      <style>{`
        .hp-nav{position:relative;top:0;left:0;right:0;z-index:30;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;padding:18px 32px;color:${t.fg};background:${t.accent};border-bottom:1px solid rgba(14,13,11,0.18)}
        .hp-mark{display:inline-flex;flex-direction:column;align-items:center;gap:2px;color:${t.fg};line-height:1;justify-self:center}
        .hp-mark .wm{font-family:${HL_FONTS.serif};font-size:26px;letter-spacing:-0.02em;font-weight:400;display:flex;align-items:center;gap:8px}
        .hp-mark .wm em{font-style:italic;font-weight:400}
        .hp-mark .sub{font-family:${HL_FONTS.mono};font-size:9px;letter-spacing:0.32em;text-transform:uppercase;opacity:0.85;margin-top:4px}
        .hp-burger{display:flex;flex-direction:column;gap:5px;cursor:pointer;background:transparent;border:0;padding:8px;justify-self:end}
        .hp-burger span{display:block;width:22px;height:1px;background:${t.fg};transition:transform .3s ease}
        .hp-burger:hover span:first-child{transform:translateX(-3px)}
        .hp-burger:hover span:last-child{transform:translateX(3px)}

        .hp-cover{position:relative;height:720px;overflow:hidden;background:${t.raised}}
        .hp-cover-img{position:absolute;inset:0;overflow:hidden}
        .hp-cover-scrim{position:absolute;inset:0;pointer-events:none;background:linear-gradient(180deg,rgba(14,13,11,0.78) 0%,rgba(14,13,11,0.42) 14%,rgba(14,13,11,0) 30%,rgba(14,13,11,0) 50%,rgba(14,13,11,0.55) 75%,rgba(14,13,11,0.95) 100%)}
        .hp-cover-meta{position:absolute;bottom:48px;left:32px;right:32px;display:flex;justify-content:space-between;align-items:flex-end;gap:48px;flex-wrap:wrap;z-index:2}
        .hp-cover-title{font-family:${HL_FONTS.serif};font-size:140px;line-height:0.92;letter-spacing:-0.04em;font-weight:400;color:#EFEAE0}
        .hp-cover-title em{font-style:italic;font-weight:400}
        @media(max-width:780px){
          .hp-cover{height:560px}
          .hp-cover-title{font-size:72px}
          .hp-cover-meta{bottom:32px;left:20px;right:20px;gap:20px}
          .hp-nav{padding:18px 20px}
        }
        .hp-scroll-hint{display:flex;flex-direction:column;align-items:center;gap:10px;color:#EFEAE0}
        .hp-scroll-hint .track{position:relative;width:1px;height:44px;background:rgba(239,234,224,0.22);overflow:hidden}
        .hp-scroll-hint .track::after{content:"";position:absolute;left:-1.5px;bottom:0;width:4px;height:4px;border-radius:50%;background:#EFEAE0;animation:hpScrollDot 1.8s infinite cubic-bezier(0.22,1,0.36,1)}
        @keyframes hpScrollDot{0%{transform:translateY(6px);opacity:0}18%{opacity:1}82%{opacity:1}100%{transform:translateY(-46px);opacity:0}}

        .hp-section-label{display:flex;align-items:center;gap:14px;padding:0 32px;margin:96px 0 32px;color:${t.muted}}
        .hp-section-label hr{flex:1;border:0;border-top:1px solid ${t.line}}

        .hp-index{padding:0 32px;border-top:1px solid ${t.line};position:relative}
        .hp-index-row{display:grid;grid-template-columns:60px 1fr 200px 120px 32px;gap:24px;align-items:center;padding:28px 0;border-bottom:1px solid ${t.line};cursor:pointer;position:relative;transition:padding .35s cubic-bezier(0.22,1,0.36,1)}
        .hp-index-row .no{font-family:${HL_FONTS.mono};font-size:11px;letter-spacing:0.08em;color:${t.muted}}
        .hp-index-row .ti{font-family:${HL_FONTS.serif};font-size:54px;line-height:1;letter-spacing:-0.02em;font-weight:400;transition:transform .22s cubic-bezier(0.22,1,0.36,1),color .15s ease}
        .hp-index-row .ta{font-family:${HL_FONTS.mono};font-size:10px;letter-spacing:0.1em;color:${t.muted};text-transform:uppercase}
        .hp-index-row .yr{font-family:${HL_FONTS.mono};font-size:11px;color:${t.muted};text-align:right}
        .hp-index-row .ar{justify-self:end;color:${t.muted};transition:transform .35s ease,color .35s ease}
        @media (hover:hover) and (pointer:fine){
          .hp-index-row:hover{padding-left:18px}
          .hp-index-row:hover .ti{font-style:italic;transform:translateX(8px)}
          .hp-index-row:hover .ar{transform:translateX(6px);color:${t.accent}}
        }
        @media(max-width:780px){
          .hp-index-row{grid-template-columns:40px 1fr 24px;gap:12px}
          .hp-index-row .ti{font-size:30px}
          .hp-index-row .ta,.hp-index-row .yr{display:none}
        }

        .hp-thumb-float{position:absolute;width:240px;height:300px;pointer-events:none;z-index:5;opacity:0;transition:opacity .2s ease,transform .25s cubic-bezier(0.22,1,0.36,1);overflow:hidden;background:${t.raised}}
        .hp-thumb-float.show{opacity:1}
        @media (hover:none){.hp-thumb-float{display:none}}
        .hp-thumb-float img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}

        .hp-view-all-row{display:flex;justify-content:center;padding:32px 32px 0}

        .hp-work{padding:0 32px}
        @media(max-width:780px){.hp-work{padding:0 20px}}
        .hp-cell{position:relative;overflow:hidden;cursor:pointer;background:${t.raised}}
        .hp-cell>img{position:absolute;inset:0;width:100%;height:100%;display:block;transition:transform .6s cubic-bezier(0.22,1,0.36,1),filter .5s ease}
        .hp-cell:hover>img{transform:scale(1.04);filter:brightness(0.82)}
        .hp-mason-cell{position:relative;overflow:hidden;cursor:pointer;background:${t.raised};break-inside:avoid}
        .hp-mason-cell>img{width:100%;height:auto;display:block;transition:transform .6s cubic-bezier(0.22,1,0.36,1),filter .5s ease}
        .hp-mason-cell:hover>img{transform:scale(1.04);filter:brightness(0.82)}

        .hp-allphotos{margin:96px 32px 0;padding:80px 64px;background:${t.accent};color:${t.fg};position:relative;overflow:hidden;display:grid;grid-template-columns:1fr auto;gap:48px;align-items:end}
        .hp-allphotos::before{content:"";position:absolute;inset:0;background:radial-gradient(120% 120% at 100% 0%,rgba(255,255,255,0.10) 0%,rgba(255,255,255,0) 55%);pointer-events:none}
        .hp-allphotos .eyebrow{font-family:${HL_FONTS.mono};font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${t.fg};opacity:0.75;margin-bottom:24px}
        .hp-allphotos h2{font-family:${HL_FONTS.serif};font-size:120px;line-height:0.9;letter-spacing:-0.035em;font-weight:400;color:${t.fg}}
        .hp-allphotos h2 em{font-style:italic}
        .hp-allphotos .sub{font-family:${HL_FONTS.sans};font-size:15px;line-height:1.6;color:${t.fg};opacity:0.85;max-width:460px;margin-top:24px}
        .hp-allphotos .cta{display:inline-flex;align-items:center;gap:16px;padding:22px 32px;background:${t.bg};color:${t.fg};border:0;cursor:pointer;font-family:${HL_FONTS.mono};font-size:12px;letter-spacing:0.18em;text-transform:uppercase;transition:transform .3s cubic-bezier(0.22,1,0.36,1),background .3s ease}
        .hp-allphotos .cta:hover{transform:translateY(-3px);background:${t.fg};color:${t.bg}}
        .hp-allphotos .cta .ico{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:50%;background:${t.accent};color:${t.fg};font-size:16px;transition:transform .3s ease,background .3s ease}
        .hp-allphotos .cta:hover .ico{transform:rotate(-12deg);background:${t.bg};color:${t.fg}}
        @media(max-width:980px){.hp-allphotos{grid-template-columns:1fr;padding:56px 32px;align-items:start}.hp-allphotos h2{font-size:72px}}
        @media(max-width:640px){.hp-allphotos{margin:64px 16px 0;padding:48px 24px}.hp-allphotos h2{font-size:54px}}

        .hp-about{display:grid;grid-template-columns:320px 1fr;gap:64px;padding:0 32px 96px;align-items:stretch}
        @media(max-width:780px){.hp-about{grid-template-columns:1fr;gap:32px;padding-bottom:64px}.hp-about-portrait{aspect-ratio:1/1 !important;max-width:280px;min-height:0 !important}}
        .hp-about-portrait{position:relative;overflow:hidden;background-color:${t.raised};width:100%;min-height:480px}
        .hp-about h2{font-family:${HL_FONTS.serif};font-size:72px;line-height:0.95;letter-spacing:-0.03em;margin-bottom:24px;font-weight:400}
        .hp-about h2 em{font-style:italic}
        .hp-about p{font-size:16px;line-height:1.7;color:${t.fg};max-width:520px}
        .hp-about-actions{display:flex;align-items:center;gap:24px;margin-top:32px;flex-wrap:wrap}

        .hp-contact{padding:120px 32px;text-align:center;border-top:1px solid ${t.line}}
        .hp-contact h2{font-family:${HL_FONTS.serif};font-size:96px;line-height:1;letter-spacing:-0.03em;font-weight:400;margin-bottom:24px}
        @media(max-width:780px){.hp-contact h2{font-size:56px}}
        .hp-contact h2 em{font-style:italic;color:${t.accent}}
        .hp-contact .tag{max-width:480px;margin:0 auto 40px;color:${t.fg};opacity:0.82;line-height:1.6}
        .hp-contact-form{max-width:520px;margin:0 auto;display:grid;gap:0}
        .hp-contact-form input,.hp-contact-form textarea{background:transparent;border:0;border-bottom:1px solid ${t.line};color:${t.fg};font-family:${HL_FONTS.sans};font-size:14px;padding:18px 0;outline:none;transition:border-color .2s ease}
        .hp-contact-form input:focus,.hp-contact-form textarea:focus{border-color:${t.accent}}
        .hp-contact-form textarea{resize:none;min-height:120px}
        .hp-contact-actions{display:flex;justify-content:space-between;align-items:center;margin-top:32px;flex-wrap:wrap;gap:12px}
        .hp-contact-sent{max-width:520px;margin:0 auto;display:flex;flex-direction:column;align-items:center;gap:14px;color:${t.fg}}
        .hp-contact-sent .ring{width:44px;height:44px;border-radius:50%;border:1px solid ${t.line};display:flex;align-items:center;justify-content:center}
        .hp-contact-sent .msg{font-family:${HL_FONTS.serif};font-style:italic;font-size:22px}

        .hp-socials{display:inline-flex;gap:10px}
        .hp-socials a{width:38px;height:38px;border-radius:50%;border:1px solid ${t.line};color:${t.muted};display:inline-flex;align-items:center;justify-content:center;transition:color .25s ease,border-color .25s ease,background .25s ease}
        .hp-socials a:hover{color:${t.bg};background:${t.fg};border-color:${t.fg}}
        .hp-socials a svg{width:15px;height:15px}

        .hp-foot{display:flex;justify-content:space-between;align-items:center;padding:32px;border-top:1px solid ${t.line};color:${t.muted};flex-wrap:wrap;gap:16px}
        .hp-foot .mark{font-family:${HL_FONTS.serif};font-size:18px;color:${t.fg}}
        .hp-foot .mark em{font-style:italic}

        .hp-drawer{position:fixed;inset:0;z-index:50;background:${t.bg};display:flex;align-items:center;gap:64px;padding:64px;transform:translateX(-100%);transition:transform .55s cubic-bezier(0.76,0,0.24,1)}
        .hp-drawer.open{transform:translateX(0)}
        .hp-drawer .col-l{flex:1;min-width:0;max-width:640px}
        .hp-drawer .col-r{flex-shrink:0;width:540px;aspect-ratio:3/4;max-height:84vh;position:relative;border:1px solid ${t.line};overflow:hidden;background:${t.raised}}
        .hp-drawer .col-r img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
        .hp-drawer .col-r .label{position:absolute;left:0;right:0;bottom:0;font-family:${HL_FONTS.mono};font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:${t.fg};padding:14px 18px;background:rgba(14,13,11,0.85);border-top:1px solid rgba(239,234,224,0.08);display:flex;justify-content:space-between;align-items:center;opacity:0;transition:opacity .3s ease}
        .hp-drawer .col-r.has-hover .label{opacity:1}
        .hp-drawer .col-r .label em{font-family:${HL_FONTS.serif};font-style:italic;font-size:14px;color:${t.fg};letter-spacing:0;text-transform:none}
        @media(max-width:780px){.hp-drawer{padding:32px}.hp-drawer .col-l{flex:1;width:100%}.hp-drawer .col-r{display:none}}
        .hp-drawer li{padding:16px 0;border-bottom:1px solid ${t.line};font-family:${HL_FONTS.serif};font-size:36px;cursor:pointer;display:flex;justify-content:space-between;align-items:center}
        .hp-drawer li .n{font-family:${HL_FONTS.mono};font-size:11px;color:${t.muted};font-style:normal}
        .hp-drawer li .all-icon{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border:1px solid ${t.line};border-radius:50%;color:${t.fg};transition:all .25s ease}
        .hp-drawer li:hover .all-icon{border-color:${t.fg};background:${t.fg};color:${t.bg};transform:translateX(4px)}
        .hp-drawer-close{position:absolute;top:24px;right:32px;background:transparent;border:0;color:${t.fg};cursor:pointer;font-family:${HL_FONTS.mono};font-size:11px;letter-spacing:0.1em;text-transform:uppercase}

        .hp-detail{position:fixed;inset:0;z-index:40;background:${t.bg};overflow-y:auto}
        .hp-detail-hero{position:relative;height:520px;overflow:hidden}
        .hp-detail-hero img{width:100%;height:100%;object-fit:cover}
        .hp-detail-hero::before{content:"";position:absolute;inset:0;background:${t.accent};mix-blend-mode:multiply;opacity:0.55;z-index:1;pointer-events:none}
        .hp-detail-hero::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(14,13,11,0.35) 0%,rgba(14,13,11,0) 30%,rgba(14,13,11,0) 45%,rgba(14,13,11,0.7) 75%,rgba(14,13,11,0.96) 100%);z-index:2}
        .hp-detail-meta{position:absolute;bottom:48px;left:32px;right:32px;display:flex;justify-content:space-between;align-items:flex-end;gap:48px;color:#fff;flex-wrap:wrap;z-index:3}
        .hp-detail-title{font-family:${HL_FONTS.serif};font-size:104px;line-height:0.95;letter-spacing:-0.03em;font-weight:400;color:#fff;text-shadow:0 2px 24px rgba(0,0,0,0.45)}
        @media(max-width:780px){.hp-detail-title{font-size:56px}}
        .hp-detail-title em{font-style:italic}
        .hp-detail-info{font-family:${HL_FONTS.mono};font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#fff;display:grid;gap:8px;text-align:right;min-width:220px}
        .hp-detail-info .row{display:flex;justify-content:space-between;gap:18px;border-bottom:1px solid rgba(255,255,255,0.4);padding-bottom:6px}
        .hp-detail-grid{padding:48px 32px;column-count:3;column-gap:14px}
        @media(max-width:1100px){.hp-detail-grid{column-count:2}}
        @media(max-width:640px){.hp-detail-grid{column-count:1}}
        .hp-detail-grid .item{break-inside:avoid;margin-bottom:14px;position:relative;cursor:pointer;overflow:hidden;background:${t.raised}}
        .hp-detail-grid .item img{width:100%;height:auto;display:block}
        .hp-detail-close{position:fixed;top:24px;right:32px;z-index:41;width:44px;height:44px;border-radius:50%;border:1px solid ${t.line};background:${t.raised};color:${t.fg};cursor:pointer;display:flex;align-items:center;justify-content:center;font-family:${HL_FONTS.mono};font-size:14px;transition:all .25s ease}
        .hp-detail-close:hover{background:${t.fg};color:${t.bg};border-color:${t.fg};transform:rotate(90deg)}

        .hp-gallery{position:fixed;inset:0;z-index:45;background:${t.bg};overflow-y:auto;padding:32px}
        .hp-gallery-head{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:48px;padding-top:48px;flex-wrap:wrap;gap:16px}
        .hp-gallery-head h2{font-family:${HL_FONTS.serif};font-size:96px;letter-spacing:-0.03em;line-height:0.95;font-weight:400}
        @media(max-width:780px){.hp-gallery-head h2{font-size:48px}}
        .hp-gallery-head h2 em{font-style:italic}
        .hp-mason{column-count:4;column-gap:18px}
        @media(max-width:1100px){.hp-mason{column-count:3}}
        @media(max-width:680px){.hp-mason{column-count:2;column-gap:8px}}
        .hp-mason .cell{break-inside:avoid;margin-bottom:18px;cursor:pointer;overflow:hidden;position:relative}
        .hp-mason .cell img{width:100%;display:block}
        .hp-mason .cell .cap{position:absolute;left:12px;bottom:12px;font-family:${HL_FONTS.mono};font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:${t.fg};background:rgba(14,13,11,0.7);padding:4px 8px;opacity:0;transition:opacity .25s ease}
        .hp-mason .cell:hover .cap{opacity:1}

        .hp-entra{animation:hp-entra .4s cubic-bezier(.22,1,.36,1) both}
        @keyframes hp-entra{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}
        @media (prefers-reduced-motion:reduce){.hp-entra{animation:none}}
        .hp-lb{position:fixed;inset:0;z-index:60;background:rgba(8,8,7,0.96);display:flex;align-items:center;justify-content:center}
        .hp-lb-img{max-width:78vw;max-height:78vh;object-fit:contain;box-shadow:0 30px 80px rgba(0,0,0,0.6)}
        .hp-lb-meta{position:fixed;bottom:32px;left:0;right:0;display:flex;justify-content:space-between;padding:0 48px;color:${t.fg};flex-wrap:wrap;gap:8px}
        .hp-lb-counter{font-family:${HL_FONTS.mono};font-size:11px;letter-spacing:0.1em;text-transform:uppercase}
        .hp-lb-cap{font-family:${HL_FONTS.serif};font-style:italic;font-size:18px}
        .hp-lb-arrow{position:fixed;top:50%;transform:translateY(-50%);background:transparent;border:1px solid ${t.line};color:${t.fg};width:48px;height:48px;cursor:pointer;font-family:${HL_FONTS.mono};font-size:14px;transition:all .25s ease}
        .hp-lb-arrow:hover{background:${t.fg};color:${t.bg}}
        .hp-lb-arrow.l{left:32px}.hp-lb-arrow.r{right:32px}
        .hp-lb-x{position:fixed;top:32px;right:32px;background:transparent;border:0;color:${t.fg};cursor:pointer;font-family:${HL_FONTS.mono};font-size:11px;letter-spacing:0.1em;text-transform:uppercase}
      `}</style>

      {/* ── NAV ── */}
      <div className="hp-nav" id="section-nav">
        <span aria-hidden />
        <div className="hp-mark">
          <div className="wm"><Brand nodeId="hl-mark-name" /></div>
          <EditableNode id="hl-mark-sub" tag="div" className="sub"><EditableText id="hl-mark-sub" display="inline" /></EditableNode>
        </div>
        <button className="hp-burger" onClick={guard(() => setNavOpen(true))} aria-label="Abrir menú">
          <span></span><span></span><span></span>
        </button>
      </div>

      {/* ── COVER ── */}
      <section className="hp-cover" id="hl-cover">
        <EditableNode id="hl-cover-image" style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
          <EditableImage id="hl-cover-image" imgStyle={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        </EditableNode>
        <div className="hp-cover-scrim" />
        <div className="hp-cover-meta">
          <EditableNode id="hl-cover-title" tag="h1" className="hp-cover-title">
            <EditableText id="hl-cover-title" />
          </EditableNode>
          <div className="hp-scroll-hint">
            <span className="hl-mono" style={{ color: "#EFEAE0", opacity: 0.75, letterSpacing: "0.18em" }}>Bajá</span>
            <div className="track" />
          </div>
        </div>
      </section>

      {/* ── SELECTED WORK ── */}
      <div className="hp-section-label hl-mono" id="hl-work">
        <EditableNode id="hl-work-label" tag="span"><EditableText id="hl-work-label" display="inline" /></EditableNode>
        <hr />
        <span>{String(proyectos.length).padStart(2, "0")} {proyectos.length === 1 ? "Serie" : "Series"}</span>
      </div>

      {grid.layout === "index" ? (
        <>
          {/* Halcyon's signature: a typographic project list with hover preview. */}
          <div
            className="hp-index"
            onMouseLeave={() => setHoverIdx(-1)}
            onMouseMove={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              const el = document.getElementById("hp-thumb-float");
              if (el) { el.style.left = `${e.clientX - r.left + 24}px`; el.style.top = `${e.clientY - r.top - 150}px`; }
            }}
          >
            <div id="hp-thumb-float" className={`hp-thumb-float ${hoverIdx >= 0 ? "show" : ""}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {indexImageSrc && <img key={indexImageSrc} src={indexImageSrc} alt="" />}
            </div>
            {visibleProjects.map((p, i) => (
              <div key={p.id} className="hp-index-row" onMouseEnter={() => setHoverIdx(i)} onClick={guard(() => setActiveProject(p.id))}>
                <span className="no">{p.no}</span>
                <span className="ti">{p.title}</span>
                <span className="ta">{p.photos.length} {p.photos.length === 1 ? "foto" : "fotos"}</span>
                <span className="yr">{p.year}</span>
                <span className="ar">→</span>
              </div>
            ))}
          </div>
          {hiddenCount > 0 && !showAllWorks && (
            <div className="hp-view-all-row">
              <Clickable className="hl-btn hl-btn-accent" onActivate={() => setShowAllWorks(true)}>
                <EditableNode id="hl-viewall" tag="span"><EditableText id="hl-viewall" display="inline" /></EditableNode>
                <span>↓</span>
              </Clickable>
            </div>
          )}
        </>
      ) : (
        /* Photo grids — shared layouts with Minimal BW, on the user's photos. */
        <div className="hp-work">
          {grid.layout === "masonry" ? (
            <div style={{ columnCount: cols, columnGap: grid.gap }}>
              {pagedWorks.map((w, i) => (
                <div key={w.id + i} className="hp-mason-cell" style={{ marginBottom: grid.gap }} onClick={() => openLightbox(pagedWorks, i)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={w.src} alt={w.title} />
                </div>
              ))}
            </div>
          ) : grid.layout === "mosaic" ? (
            <MosaicGrid works={featured} gap={grid.gap} fit={grid.fit} isMobile={isMobile} isTablet={isTablet} onOpen={(i) => openLightbox(featured, i)} />
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: grid.gap }}>
              {pagedWorks.map((w, i) => (
                <div key={w.id + i} className="hp-cell" style={{ aspectRatio: isMobile ? "1 / 1" : "4 / 5" }} onClick={() => openLightbox(pagedWorks, i)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={w.src} alt={w.title} style={{ objectFit: grid.fit }} />
                </div>
              ))}
            </div>
          )}
          {canLoadMore && (
            <div className="hp-view-all-row">
              <button className="hl-btn" onClick={() => setVisibleCount((c) => c + grid.pageSize)}>Ver más <span>↓</span></button>
            </div>
          )}
        </div>
      )}

      {/* ── ARCHIVE BANNER ── */}
      <section className="hp-allphotos" id="hl-archive">
        <div>
          <EditableNode id="hl-archive-eyebrow" tag="div" className="eyebrow"><EditableText id="hl-archive-eyebrow" display="inline" /></EditableNode>
          <EditableNode id="hl-archive-title" tag="h2"><EditableText id="hl-archive-title" /></EditableNode>
          <EditableNode id="hl-archive-sub" tag="p" className="sub"><EditableText id="hl-archive-sub" /></EditableNode>
        </div>
        <Clickable className="cta" onActivate={() => setGalleryOpen(true)}>
          <EditableNode id="hl-archive-cta" tag="span"><EditableText id="hl-archive-cta" display="inline" /></EditableNode>
          <span className="ico" aria-hidden>↗</span>
        </Clickable>
      </section>

      {/* ── ABOUT ── */}
      <div className="hp-section-label hl-mono">
        <EditableNode id="hl-about-label" tag="span"><EditableText id="hl-about-label" display="inline" /></EditableNode>
        <hr />
        <span>{[perfil.nombre, perfil.ubicacion].filter(Boolean).join(" · ")}</span>
      </div>
      <section className="hp-about" id="hl-about">
        <EditableNode id="hl-about-image" className="hp-about-portrait">
          <EditableImage id="hl-about-image" imgStyle={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        </EditableNode>
        <div>
          <EditableNode id="hl-about-heading" tag="h2"><EditableText id="hl-about-heading" /></EditableNode>
          <EditableNode id="hl-about-bio" tag="p"><EditableText id="hl-about-bio" /></EditableNode>
          <div className="hp-about-actions">
            <Clickable kind="a" href="#contact" className="hl-btn hl-btn-accent">
              <EditableNode id="hl-about-cta" tag="span"><EditableText id="hl-about-cta" display="inline" /></EditableNode>
              <span>↓</span>
            </Clickable>
            <Socials />
          </div>
        </div>
      </section>

      {/* ── CONTACT ── */}
      <section id="contact" className="hp-contact">
        <EditableNode id="hl-contact-eyebrow" tag="div" className="hl-eyebrow" style={{ marginBottom: 24 }}>
          <EditableText id="hl-contact-eyebrow" display="inline" />
        </EditableNode>
        <EditableNode id="hl-contact-heading" tag="h2"><EditableText id="hl-contact-heading" /></EditableNode>
        <EditableNode id="hl-contact-tag" tag="p" className="tag"><EditableText id="hl-contact-tag" /></EditableNode>
        <HlContactForm />
      </section>

      {/* ── FOOTER ── */}
      <footer className="hp-foot" id="section-footer">
        <Brand nodeId="hl-footer-mark" className="mark" />
        <EditableNode id="hl-footer-copy" tag="div" className="hl-mono"><EditableText id="hl-footer-copy" display="inline" /></EditableNode>
        <Socials />
      </footer>

      {/* ── Preview-only interactions (live site only; never overlay the editor) ── */}
      {readOnly && (
        <>
          {/* DRAWER */}
          <div className={`hp-drawer ${navOpen ? "open" : ""}`} onMouseLeave={() => setDrawerHoverId(null)}>
            <button className="hp-drawer-close" onClick={() => setNavOpen(false)}>Cerrar ✕</button>
            <div className="col-l">
              <div className="hl-eyebrow" style={{ marginBottom: 32 }}>Mi trabajo</div>
              <ul>
                {proyectos.map((p) => (
                  <li key={p.id} onMouseEnter={() => setDrawerHoverId(p.id)} onClick={() => { setActiveProject(p.id); setNavOpen(false); }}>
                    <span>{p.title}</span>
                    <span className="n">{[p.no, p.year].filter(Boolean).join(" · ")}</span>
                  </li>
                ))}
                <li onMouseEnter={() => setDrawerHoverId(null)} onClick={() => { setGalleryOpen(true); setNavOpen(false); }}>
                  <span>Todas las fotos</span>
                  <span className="all-icon" aria-hidden><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></svg></span>
                </li>
              </ul>
            </div>
            <div className={`col-r ${drawerHoverId ? "has-hover" : ""}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {drawerImageSrc && <img key={drawerImageSrc} src={drawerImageSrc} alt="" />}
              {drawerProject && (
                <div className="label"><em>{drawerProject.title}</em><span>1 / {drawerProject.photos.length}</span></div>
              )}
            </div>
          </div>

          {/* DETAIL */}
          {project && (
              <div key="hp-detail" className="hp-detail hp-entra">
                <button className="hp-detail-close" onClick={() => setActiveProject(null)} aria-label="Cerrar serie"><span>✕</span></button>
                <div className="hp-detail-hero">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={detailPhotos[0]?.src} alt={project.title} />
                  <div className="hp-detail-meta">
                    <h1 className="hp-detail-title">{project.title.split(" ").map((w, i) => i % 2 ? <em key={i}>{w} </em> : <span key={i}>{w} </span>)}</h1>
                    <div className="hp-detail-info">
                      <div className="row"><span>N.º</span><span>{project.no}</span></div>
                      {project.year && <div className="row"><span>Año</span><span>{project.year}</span></div>}
                      <div className="row"><span>Fotos</span><span>{detailPhotos.length}</span></div>
                    </div>
                  </div>
                </div>
                <div className="hp-detail-grid">
                  {detailPhotos.map((ph, i) => (
                    <div key={ph.id} className="item" onClick={() => setLightbox({ photos: detailPhotos, index: i })}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={ph.src} alt={ph.title} loading="lazy" />
                    </div>
                  ))}
                </div>
              </div>
          )}

          {/* ARCHIVO */}
          {galleryOpen && (
              <div key="hp-gallery" className="hp-gallery hp-entra">
                <button className="hp-detail-close" style={{ position: "absolute" }} onClick={() => setGalleryOpen(false)} aria-label="Cerrar archivo"><span>✕</span></button>
                <div className="hp-gallery-head"><h2><EditableText id="hl-archive-title" display="inline" /></h2></div>
                <div className="hp-mason">
                  {allPhotos.map((ph, i) => (
                    <div key={ph.id + i} className="cell" onClick={() => setLightbox({ photos: allPhotos, index: i })}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={ph.src} alt={ph.title} />
                      {(ph.title || ph.projectTitle) && <div className="cap">{[ph.title, ph.projectTitle].filter(Boolean).join(" · ")}</div>}
                    </div>
                  ))}
                </div>
              </div>
          )}

          {/* LIGHTBOX */}
          {lightbox?.photos[lightbox.index] && (
            <div className="hp-lb" onClick={(e) => { if (e.target === e.currentTarget) setLightbox(null); }}>
              <button className="hp-lb-x" onClick={() => setLightbox(null)}>Cerrar ✕</button>
              <button className="hp-lb-arrow l" onClick={() => setLightbox((l) => l && ({ ...l, index: (l.index - 1 + l.photos.length) % l.photos.length }))} aria-label="Anterior">←</button>
              <button className="hp-lb-arrow r" onClick={() => setLightbox((l) => l && ({ ...l, index: (l.index + 1) % l.photos.length }))} aria-label="Siguiente">→</button>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="hp-lb-img" src={lightbox.photos[lightbox.index]!.src} alt={lightbox.photos[lightbox.index]!.title} />
              <div className="hp-lb-meta">
                <div className="hp-lb-counter">{String(lightbox.index + 1).padStart(3, "0")} / {String(lightbox.photos.length).padStart(3, "0")}</div>
                <div className="hp-lb-cap">{lightbox.photos[lightbox.index]!.title}</div>
                <div className="hp-lb-counter">{lightbox.photos[lightbox.index]!.date}</div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* Contact section — follows the owner's choice (store.contact: inbox vs
   WhatsApp), mirroring Minimal BW. Submits only on the live site (readOnly). */
function HlContactForm() {
  const contact  = useEditorStore((s) => s.contact);
  const enviar   = useEditorStore((s) => s.enviarConsulta);
  const readOnly = useEditorStore((s) => s.readOnly);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!readOnly) return; // editing the canvas — don't submit
    const fd = new FormData(e.currentTarget);
    const name    = campo(fd, "name");
    const email   = campo(fd, "email");
    const project = campo(fd, "project");
    const body    = campo(fd, "message");
    const message = [project, body].filter(Boolean).join(" — ");

    if (contact.mode === "whatsapp") {
      const digits = contact.whatsapp.replace(/[^\d]/g, "");
      const text   = fillWaTemplate(contact.waTemplate, { name, email, message });
      window.open(digits ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
      setStatus("sent");
      return;
    }
    if (!enviar) { setStatus("sent"); return; } // vista previa: no se manda nada
    try {
      setStatus("sending");
      await enviar({ name, email, message });
      setStatus("sent");
    } catch { setStatus("error"); }
  }

  if (status === "sent") {
    return (
      <div className="hp-contact-sent">
        <div className="ring">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <div className="msg">{contact.mode === "whatsapp" ? "Abriendo WhatsApp…" : "Listo, te respondo pronto."}</div>
      </div>
    );
  }

  return (
    <form className="hp-contact-form" onSubmit={onSubmit}>
      <input name="name" placeholder="Tu nombre" required aria-label="Tu nombre" />
      <input name="email" type="email" placeholder="Email" required aria-label="Email" />
      <input name="project" placeholder="Evento · fecha · lugar" aria-label="Evento, fecha y lugar" />
      <textarea name="message" placeholder="Contame en pocas líneas qué tenés en mente." required aria-label="Mensaje" />
      <div className="hp-contact-actions">
        <span className="hl-mono" style={{ color: t.muted }}>
          {contact.mode === "whatsapp" ? "Se abre en WhatsApp" : status === "error" ? "No se pudo mandar. Probá de nuevo." : "Te llega la respuesta por email"}
        </span>
        <button type="submit" className="hl-btn hl-btn-accent" disabled={status === "sending"}>
          {contact.mode === "whatsapp" ? "Mandar por WhatsApp →" : status === "sending" ? "Mandando…" : "Mandar →"}
        </button>
      </div>
    </form>
  );
}

/* Mosaic — editorial mixed-size grid, mirroring Minimal BW's "mosaic" layout. */
function MosaicGrid({ works, gap, fit, isMobile, isTablet, onOpen }: {
  works: GalleryPhoto[];
  gap: number;
  fit: "cover" | "contain";
  isMobile: boolean;
  isTablet: boolean;
  onOpen: (i: number) => void;
}) {
  const cell = (key: React.Key, i: number, style?: React.CSSProperties) => {
    const w = works[i];
    if (!w) return null;
    return (
      <div key={key} className="hp-cell" style={style} onClick={() => onOpen(i)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={w.src} alt={w.title} style={{ objectFit: fit }} />
      </div>
    );
  };

  if (isMobile) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap }}>
        {works.map((_, i) => cell(i, i, { aspectRatio: "1 / 1" }))}
      </div>
    );
  }
  if (isTablet || works.length < 8) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: isTablet ? "1fr 1fr" : "1fr 1fr 1fr", gap }}>
        {works.map((_, i) => cell(i, i, { aspectRatio: "4 / 5" }))}
      </div>
    );
  }
  // Desktop editorial layout (≥ 8 photos).
  return (
    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gridTemplateRows: "280px 280px 360px 320px", gap }}>
      {cell("a", 0, { gridRow: "1 / 3", gridColumn: "1" })}
      {cell("b", 1, { gridRow: "1", gridColumn: "2" })}
      {cell("c", 2, { gridRow: "1", gridColumn: "3" })}
      {cell("d", 3, { gridRow: "2", gridColumn: "2" })}
      {cell("e", 4, { gridRow: "2", gridColumn: "3" })}
      {cell("f", 5, { gridRow: "3", gridColumn: "1 / 3" })}
      {cell("g", 6, { gridRow: "3", gridColumn: "3" })}
      {cell("h", 7, { gridRow: "4", gridColumn: "1" })}
      {cell("i", 0, { gridRow: "4", gridColumn: "2 / 4" })}
    </div>
  );
}
