"use client";

/**
 * Meridian — clara y ordenada, como una muestra de museo.
 *
 * Viene de photo-saas (components/editor/canvas/MeridianTemplate.tsx). Lo que
 * cambió al traerla:
 *  - Sin fotos de demo: la grilla muestra las del portfolio, con el evento de
 *    cada una como epígrafe.
 *  - El formulario manda la consulta por store.enviarConsulta, no por tRPC.
 *  - El pie muestra la ubicación del fotógrafo, no coordenadas de Lisboa.
 *  - Todo el texto fijo, en castellano.
 *
 * Lo responsive sale de la prop `viewport`, no de media queries (así el
 * editor puede mostrarla en celular sin achicar la ventana).
 */

import { useEffect, useMemo, useState } from "react";
import { useEditorStore } from "../store";
import { campo, fillWaTemplate } from "../whatsapp";
import type { Viewport } from "../tipos";
import { EditableNode, EditableText, EditableImage, LogoImage } from "../primitivas";

/* ── Design tokens — everything resolves to the Design-panel variables ── */
const C = {
  bg:     "var(--ed-bg, #F4F2ED)",
  fg:     "var(--ed-fg, #16181B)",
  accent: "var(--ed-accent, #2E4E6B)",
  muted:  "var(--ed-muted, #8B8E93)",
  line:   "color-mix(in srgb, var(--ed-fg, #16181B) 14%, transparent)",
  body:   "color-mix(in srgb, var(--ed-fg, #16181B) 82%, var(--ed-bg, #F4F2ED))",
  raised: "color-mix(in srgb, var(--ed-fg, #16181B) 5%, var(--ed-bg, #F4F2ED))",
};
const SERIF = "var(--tpl-serif, 'Playfair Display', Georgia, serif)";
const SANS  = "var(--tpl-sans, 'Manrope', system-ui, sans-serif)";
const MONO  = "var(--tpl-mono, 'IBM Plex Mono', ui-monospace, monospace)";

const mono = (size: number, extra?: React.CSSProperties): React.CSSProperties => ({
  fontFamily: MONO, fontSize: size, letterSpacing: "0.16em", textTransform: "uppercase", ...extra,
});

type Work = { id: string; src: string; title?: string };

function useWorks(): Work[] {
  const galleryPhotos = useEditorStore((s) => s.galleryPhotos);
  return useMemo(
    () => galleryPhotos.map((p, i) => ({ id: `g${i}`, src: p.src, title: p.title?.length ? p.title : p.group })),
    [galleryPhotos]
  );
}

/* ── Clickable — real button/anchor on the live site, plain span in the editor
      so editable labels keep Space/Enter and clicks select instead of firing. ── */
function Clickable({ kind = "button", href, onActivate, style, hover, children }: {
  kind?: "button" | "a";
  href?: string;
  onActivate?: () => void;
  style?: React.CSSProperties;
  hover?: { on: (el: HTMLElement) => void; off: (el: HTMLElement) => void };
  children: React.ReactNode;
}) {
  const readOnly = useEditorStore((s) => s.readOnly);
  const base: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 10, ...style };
  const hoverProps = hover ? {
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => hover.on(e.currentTarget),
    onMouseLeave: (e: React.MouseEvent<HTMLElement>) => hover.off(e.currentTarget),
  } : {};
  if (!readOnly) return <span style={{ ...base, cursor: "default" }}>{children}</span>;
  if (kind === "a") return <a href={href} style={{ ...base, textDecoration: "none" }} {...hoverProps}>{children}</a>;
  return <button onClick={onActivate} style={{ ...base, cursor: "pointer" }} {...hoverProps}>{children}</button>;
}

/* Shared button skins */
const btnSolid: React.CSSProperties = {
  fontFamily: SANS, fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase",
  color: "var(--ed-btn-fg, var(--ed-bg, #F4F2ED))", background: "var(--ed-btn-bg, var(--ed-accent, #2E4E6B))",
  border: "1px solid var(--ed-btn-bg, var(--ed-accent, #2E4E6B))", borderRadius: "var(--ed-btn-radius, 0)",
  padding: "13px 26px",
};
const btnGhost: React.CSSProperties = {
  fontFamily: SANS, fontSize: 12, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase",
  color: C.fg, background: "transparent", border: `1px solid ${C.line}`,
  borderRadius: "var(--ed-btn-radius, 0)", padding: "13px 26px",
};

/* ── Section label — hairline rule + number + editable text ── */
function Label({ index, nodeId, isMobile }: { index: string; nodeId: string; isMobile: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: isMobile ? 28 : 44 }}>
      <span style={{ ...mono(10), color: C.accent, fontWeight: 600 }}>{index}</span>
      <div style={{ flex: 1, height: 1, background: C.line }} />
      <EditableNode id={nodeId} tag="span" style={{ ...mono(10), color: C.muted }}>
        <EditableText id={nodeId} display="inline" />
      </EditableNode>
    </div>
  );
}

/* ── Lightbox (live site only) ── */
function Lightbox({ works, startIndex, onClose }: { works: Work[]; startIndex: number; onClose: () => void }) {
  const [index, setIndex] = useState(startIndex);
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setIndex((i) => Math.min(i + 1, works.length - 1));
      if (e.key === "ArrowLeft")  setIndex((i) => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose, works.length]);
  const w = works[index]!;
  const arrow: React.CSSProperties = {
    position: "absolute", top: "50%", transform: "translateY(-50%)", width: 44, height: 44,
    display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
    background: "rgba(244,242,237,0.06)", border: "1px solid rgba(244,242,237,0.18)",
    color: "rgba(244,242,237,0.8)", borderRadius: "50%",
  };
  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(12,13,15,0.96)", display: "flex", alignItems: "center", justifyContent: "center", padding: "56px 64px" }}>
      <button onClick={onClose} style={{ position: "absolute", top: 20, right: 24, background: "none", border: "none", cursor: "pointer", color: "rgba(244,242,237,0.7)", ...mono(11) }}>Cerrar ✕</button>
      {index > 0 && <button onClick={() => setIndex((i) => i - 1)} style={{ ...arrow, left: 16 }} aria-label="Anterior">←</button>}
      {index < works.length - 1 && <button onClick={() => setIndex((i) => i + 1)} style={{ ...arrow, right: 16 }} aria-label="Siguiente">→</button>}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={w.src} alt={w.title ?? ""} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
      <div style={{ position: "absolute", bottom: 20, left: 0, right: 0, display: "flex", justifyContent: "space-between", padding: "0 32px", color: "rgba(244,242,237,0.6)" }}>
        <span style={mono(10)}>{String(index + 1).padStart(2, "0")} / {String(works.length).padStart(2, "0")}</span>
        {w.title && <span style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 15, color: "rgba(244,242,237,0.85)" }}>{w.title}</span>}
        <span />
      </div>
    </div>
  );
}

/* ── Photo cell ── */
function Cell({ w, fit, style, onOpen }: { w?: Work; fit: "cover" | "contain"; style?: React.CSSProperties; onOpen: () => void }) {
  const [hov, setHov] = useState(false);
  if (!w) return null;
  return (
    <div onClick={onOpen} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ position: "relative", overflow: "hidden", cursor: "pointer", background: C.raised, ...style }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={w.src} alt={w.title ?? ""} loading="lazy"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: fit, display: "block",
          transform: hov ? "scale(1.03)" : "scale(1)", filter: hov ? "brightness(0.85)" : "none",
          transition: "transform 0.6s cubic-bezier(0.22,1,0.36,1), filter 0.4s ease" }} />
      {w.title && (
        <span style={{ position: "absolute", left: 12, bottom: 12, ...mono(9), color: "#F4F2ED", background: "rgba(12,13,15,0.65)", padding: "4px 8px", opacity: hov ? 1 : 0, transition: "opacity 0.25s ease" }}>
          {w.title}
        </span>
      )}
    </div>
  );
}

/* ── Contact form — follows the owner's choice (store.contact) ── */
function MeridianContactForm() {
  const contact  = useEditorStore((s) => s.contact);
  const enviar   = useEditorStore((s) => s.enviarConsulta);
  const readOnly = useEditorStore((s) => s.readOnly);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const field: React.CSSProperties = {
    fontFamily: SANS, fontSize: 13, padding: "12px 14px", width: "100%", boxSizing: "border-box",
    background: "transparent", border: `1px solid ${C.line}`, color: C.fg, outline: "none",
  };

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!readOnly) return; // editing the canvas — don't submit
    const fd = new FormData(e.currentTarget);
    const name    = campo(fd, "name");
    const email   = campo(fd, "email");
    const message = campo(fd, "message");

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
      <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-start", padding: "16px 0" }}>
        <div style={{ width: 42, height: 42, borderRadius: "50%", border: `1px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "center", color: C.accent }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <span style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 20, color: C.fg }}>
          {contact.mode === "whatsapp" ? "Abriendo WhatsApp…" : "Listo, te respondo pronto."}
        </span>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <input name="name" placeholder="Tu nombre" required aria-label="Tu nombre" style={field} />
      <input name="email" type="email" placeholder="Email" required aria-label="Email" style={field} />
      <textarea name="message" rows={5} placeholder="El evento, la fecha, el lugar…" required aria-label="Mensaje" style={{ ...field, resize: "vertical" }} />
      {status === "error" && <span style={{ ...mono(10), color: "#dc2626", textTransform: "none", letterSpacing: 0 }}>No se pudo mandar. Probá de nuevo.</span>}
      <button type="submit" disabled={status === "sending"} style={{ ...btnSolid, cursor: "pointer", opacity: status === "sending" ? 0.6 : 1 }}>
        {contact.mode === "whatsapp" ? "Mandar por WhatsApp" : status === "sending" ? "Mandando…" : "Mandar"}
      </button>
    </form>
  );
}

/* ═══════════════════════════════════════════
   TEMPLATE
═══════════════════════════════════════════ */
export function MeridianPlantilla({ viewport }: { viewport: Viewport }) {
  const { selectNode, logo, grid, readOnly, perfil } = useEditorStore();
  const isMobile = viewport === "mobile";
  const isTablet = viewport === "tablet";
  const px = isMobile ? "1.35rem" : isTablet ? "4vw" : "6vw";

  const works = useWorks();
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const openLightbox = (i: number) => { if (readOnly) setLightboxIdx(i); };

  /* Grid settings from the Design panel (shared semantics with Minimal BW) */
  const cols = isMobile ? Math.min(grid.columns, 2) : isTablet ? Math.min(grid.columns, 3) : grid.columns;
  const [visibleCount, setVisibleCount] = useState(grid.pageSize);
  useEffect(() => { setVisibleCount(grid.pageSize); }, [grid.pageSize, grid.loadMore, grid.layout, works.length]);
  const featured    = works.slice(0, 9);
  const pagedWorks  = grid.loadMore ? works.slice(0, visibleCount) : featured;
  const canLoadMore = grid.loadMore && visibleCount < works.length;

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  /* Brand — text / image / both, following Settings > Logo */
  function Brand({ nodeId, size = 17 }: { nodeId: string; size?: number }) {
    const textEl = (
      <EditableNode id={nodeId} tag="span" style={{ fontFamily: SERIF, fontSize: size, fontWeight: 500, letterSpacing: "0.01em", color: C.fg }}>
        <EditableText id={nodeId} display="inline" />
      </EditableNode>
    );
    if (logo.mode === "image" && logo.imageUrl) return <LogoImage src={logo.imageUrl} alt={logo.text} width={logo.width} crop={logo.imageCrop} />;
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

  const navItems = [
    { id: "mrd-nav-item-1", fn: () => scrollTo("mrd-work") },
    { id: "mrd-nav-item-2", fn: () => scrollTo("mrd-about") },
    { id: "mrd-nav-item-3", fn: () => scrollTo("mrd-contact") },
  ];

  return (
    <div onClick={() => selectNode(null)}
      style={{ background: C.bg, color: C.fg, minHeight: "100%", fontFamily: SANS }}>

      {/* ── NAV ── */}
      <nav id="section-nav" style={{
        position: "relative", zIndex: 50, display: "flex", alignItems: "center",
        height: isMobile ? 58 : 76, padding: `0 ${px}`,
        borderBottom: `1px solid ${C.line}`, background: C.bg,
      }}>
        <Brand nodeId="mrd-nav-brand" />
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 14 : 30, marginLeft: "auto" }}>
          {!isMobile && navItems.map((item) => (
            <Clickable key={item.id} onActivate={item.fn}
              style={{ background: "none", border: "none", padding: 0, fontFamily: SANS, fontSize: 12, fontWeight: 500, letterSpacing: "0.06em", color: C.fg, opacity: 0.65 }}
              hover={{ on: (el) => { el.style.opacity = "1"; }, off: (el) => { el.style.opacity = "0.65"; } }}>
              <EditableNode id={item.id} tag="span"><EditableText id={item.id} display="inline" /></EditableNode>
            </Clickable>
          ))}
          <Clickable onActivate={() => scrollTo("mrd-contact")} style={{ ...btnSolid, padding: isMobile ? "9px 16px" : "11px 20px", fontSize: 11 }}>
            <EditableNode id="mrd-nav-cta" tag="span"><EditableText id="mrd-nav-cta" display="inline" /></EditableNode>
          </Clickable>
        </div>
      </nav>

      {/* ── HERO — split: text | full-bleed image ── */}
      <section id="mrd-hero" style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "1.05fr 1fr",
        minHeight: isMobile ? undefined : "88vh",
        borderBottom: `1px solid ${C.line}`,
      }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: isMobile ? `3rem ${px} 2.5rem` : `4rem ${px} 4rem`, borderRight: isMobile ? "none" : `1px solid ${C.line}` }}>
          <EditableNode id="mrd-hero-eyebrow" tag="span" style={{ ...mono(10), color: C.accent, fontWeight: 600, display: "block", marginBottom: isMobile ? 20 : 30 }}>
            <EditableText id="mrd-hero-eyebrow" />
          </EditableNode>

          <EditableNode id="mrd-hero-title" tag="h1" style={{ fontFamily: SERIF, fontWeight: 500, fontSize: isMobile ? "clamp(44px,12vw,64px)" : "clamp(56px,5.5vw,96px)", lineHeight: 1.02, letterSpacing: "-0.02em", color: C.fg, margin: `0 0 ${isMobile ? "1.4rem" : "2rem"}` }}>
            <EditableText id="mrd-hero-title" />
          </EditableNode>

          <EditableNode id="mrd-hero-sub" style={{ fontFamily: SANS, fontWeight: 400, fontSize: 15, lineHeight: 1.75, color: C.body, maxWidth: 420, marginBottom: isMobile ? "1.8rem" : "2.4rem" }}>
            <EditableText id="mrd-hero-sub" />
          </EditableNode>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Clickable onActivate={() => scrollTo("mrd-work")} style={btnSolid}>
              <EditableNode id="mrd-hero-cta-1" tag="span"><EditableText id="mrd-hero-cta-1" display="inline" /></EditableNode>
            </Clickable>
            <Clickable onActivate={() => scrollTo("mrd-about")} style={btnGhost}>
              <EditableNode id="mrd-hero-cta-2" tag="span"><EditableText id="mrd-hero-cta-2" display="inline" /></EditableNode>
            </Clickable>
          </div>

          <EditableNode id="mrd-hero-meta" tag="div" style={{ ...mono(9), color: C.muted, marginTop: isMobile ? "2.2rem" : "auto", paddingTop: isMobile ? 0 : "3rem", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 24, height: 1, background: C.accent, display: "inline-block", flexShrink: 0 }} />
            <EditableText id="mrd-hero-meta" display="inline" />
          </EditableNode>
        </div>

        <div style={{ position: "relative", minHeight: isMobile ? "60vw" : undefined }}>
          <EditableNode id="mrd-hero-image" style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
            <EditableImage id="mrd-hero-image" imgStyle={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          </EditableNode>
          <EditableNode id="mrd-hero-caption" tag="div" style={{ position: "absolute", left: 16, bottom: 14, zIndex: 2, ...mono(9), color: "#F4F2ED", background: "rgba(12,13,15,0.6)", padding: "5px 10px" }}>
            <EditableText id="mrd-hero-caption" display="inline" />
          </EditableNode>
        </div>
      </section>

      {/* ── WORK — grid driven by Design > Grid ── */}
      <section id="mrd-work" style={{ padding: `${isMobile ? "3.5rem" : "6rem"} ${px}` }}>
        <Label index="01" nodeId="mrd-work-label" isMobile={isMobile} />
        <EditableNode id="mrd-work-intro" style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: isMobile ? 17 : 20, color: C.body, maxWidth: 520, marginBottom: isMobile ? "1.8rem" : "2.6rem" }}>
          <EditableText id="mrd-work-intro" />
        </EditableNode>

        {grid.layout === "masonry" ? (
          <div style={{ columnCount: cols, columnGap: grid.gap }}>
            {pagedWorks.map((w, i) => (
              <div key={w.id} style={{ breakInside: "avoid", marginBottom: grid.gap, position: "relative", overflow: "hidden", cursor: "pointer", background: C.raised }}
                onClick={() => openLightbox(i)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={w.src} alt={w.title ?? ""} loading="lazy" style={{ width: "100%", height: "auto", display: "block" }} />
              </div>
            ))}
          </div>
        ) : grid.layout === "mosaic" ? (
          !isMobile && featured.length >= 8 ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gridTemplateRows: isTablet ? "220px 220px 280px" : "300px 300px 380px", gap: grid.gap }}>
              <Cell w={featured[0]} fit={grid.fit} style={{ gridRow: "1 / 3", gridColumn: "1" }} onOpen={() => openLightbox(0)} />
              <Cell w={featured[1]} fit={grid.fit} style={{ gridRow: "1", gridColumn: "2" }} onOpen={() => openLightbox(1)} />
              <Cell w={featured[2]} fit={grid.fit} style={{ gridRow: "1", gridColumn: "3" }} onOpen={() => openLightbox(2)} />
              <Cell w={featured[3]} fit={grid.fit} style={{ gridRow: "2", gridColumn: "2 / 4" }} onOpen={() => openLightbox(3)} />
              <Cell w={featured[4]} fit={grid.fit} style={{ gridRow: "3", gridColumn: "1" }} onOpen={() => openLightbox(4)} />
              <Cell w={featured[5]} fit={grid.fit} style={{ gridRow: "3", gridColumn: "2" }} onOpen={() => openLightbox(5)} />
              <Cell w={featured[6]} fit={grid.fit} style={{ gridRow: "3", gridColumn: "3" }} onOpen={() => openLightbox(6)} />
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr", gap: grid.gap }}>
              {featured.map((w, i) => (
                <Cell key={w.id} w={w} fit={grid.fit} style={{ aspectRatio: isMobile ? "1 / 1" : "4 / 5" }} onOpen={() => openLightbox(i)} />
              ))}
            </div>
          )
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: grid.gap }}>
            {pagedWorks.map((w, i) => (
              <Cell key={w.id} w={w} fit={grid.fit} style={{ aspectRatio: isMobile ? "1 / 1" : "4 / 5" }} onOpen={() => openLightbox(i)} />
            ))}
          </div>
        )}

        {canLoadMore && (
          <div style={{ marginTop: "2.5rem", display: "flex", justifyContent: "center" }}>
            <button onClick={() => setVisibleCount((c) => c + grid.pageSize)}
              style={{ ...btnGhost, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 10 }}>
              Ver más <span aria-hidden>↓</span>
            </button>
          </div>
        )}
      </section>

      {/* ── SERVICES — numbered, gallery-wall spacing ── */}
      <section id="mrd-services" style={{ padding: `${isMobile ? "3.5rem" : "6rem"} ${px}`, borderTop: `1px solid ${C.line}`, background: C.raised }}>
        <Label index="02" nodeId="mrd-serv-label" isMobile={isMobile} />
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: isMobile ? "2.2rem" : "3.5rem" }}>
          {([["mrd-serv-1-title","mrd-serv-1-desc","I."],["mrd-serv-2-title","mrd-serv-2-desc","II."],["mrd-serv-3-title","mrd-serv-3-desc","III."]] as const).map(([tId, dId, num]) => (
            <div key={tId}>
              <span style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 22, color: C.accent, display: "block", marginBottom: 14 }}>{num}</span>
              <EditableNode id={tId} tag="h3" style={{ fontFamily: SERIF, fontWeight: 500, fontSize: isMobile ? 22 : 26, lineHeight: 1.15, color: C.fg, margin: "0 0 0.7rem", letterSpacing: "-0.01em" }}>
                <EditableText id={tId} />
              </EditableNode>
              <EditableNode id={dId} style={{ fontFamily: SANS, fontSize: 14, lineHeight: 1.7, color: C.body }}>
                <EditableText id={dId} />
              </EditableNode>
            </div>
          ))}
        </div>
      </section>

      {/* ── ABOUT — portrait plate + argument ── */}
      <section id="mrd-about" style={{ padding: `${isMobile ? "3.5rem" : "6.5rem"} ${px}`, borderTop: `1px solid ${C.line}` }}>
        <Label index="03" nodeId="mrd-about-label" isMobile={isMobile} />
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(260px, 380px) 1fr", gap: isMobile ? "2.2rem" : "5rem", alignItems: "start" }}>
          <EditableNode id="mrd-about-image" style={{ position: "relative", width: "100%", maxWidth: isMobile ? 320 : undefined, aspectRatio: "4 / 5", overflow: "hidden", background: C.raised, border: `1px solid ${C.line}`, padding: 10, boxSizing: "border-box" }}>
            <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
              <EditableImage id="mrd-about-image" imgStyle={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            </div>
          </EditableNode>
          <div>
            <EditableNode id="mrd-about-heading" tag="h2" style={{ fontFamily: SERIF, fontWeight: 500, fontSize: isMobile ? "clamp(30px,9vw,42px)" : "clamp(36px,3.6vw,56px)", lineHeight: 1.08, letterSpacing: "-0.015em", color: C.fg, margin: "0 0 1.4rem" }}>
              <EditableText id="mrd-about-heading" />
            </EditableNode>
            <EditableNode id="mrd-about-body" style={{ fontFamily: SANS, fontSize: 15, lineHeight: 1.8, color: C.body, maxWidth: 560, marginBottom: "2.2rem" }}>
              <EditableText id="mrd-about-body" />
            </EditableNode>
            <div style={{ display: "flex", gap: isMobile ? "1.8rem" : "3rem", paddingTop: "1.8rem", borderTop: `1px solid ${C.line}` }}>
              {([["mrd-stat-1-value","mrd-stat-1-label"],["mrd-stat-2-value","mrd-stat-2-label"],["mrd-stat-3-value","mrd-stat-3-label"]] as const).map(([vId, lId]) => (
                <div key={vId}>
                  <EditableNode id={vId} style={{ fontFamily: SERIF, fontSize: isMobile ? 26 : 34, fontWeight: 500, color: C.accent, lineHeight: 1 }}>
                    <EditableText id={vId} />
                  </EditableNode>
                  <EditableNode id={lId} style={{ ...mono(9), color: C.muted, marginTop: 6 }}>
                    <EditableText id={lId} />
                  </EditableNode>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CONTACT ── */}
      <section id="mrd-contact" style={{ padding: `${isMobile ? "3.5rem" : "6.5rem"} ${px} ${isMobile ? "4rem" : "7rem"}`, borderTop: `1px solid ${C.line}`, background: C.raised }}>
        <Label index="04" nodeId="mrd-contact-label" isMobile={isMobile} />
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? "2.5rem" : "5rem", alignItems: "start" }}>
          <div>
            <EditableNode id="mrd-contact-heading" tag="h2" style={{ fontFamily: SERIF, fontWeight: 500, fontSize: isMobile ? "clamp(34px,10vw,48px)" : "clamp(40px,4.2vw,64px)", lineHeight: 1.05, letterSpacing: "-0.015em", color: C.fg, margin: "0 0 1.3rem" }}>
              <EditableText id="mrd-contact-heading" />
            </EditableNode>
            <EditableNode id="mrd-contact-body" style={{ fontFamily: SANS, fontSize: 14, lineHeight: 1.75, color: C.body, maxWidth: 420, marginBottom: "2rem" }}>
              <EditableText id="mrd-contact-body" />
            </EditableNode>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {([["mrd-contact-d1-label","mrd-contact-d1-value"],["mrd-contact-d2-label","mrd-contact-d2-value"],["mrd-contact-d3-label","mrd-contact-d3-value"]] as const).map(([lId, vId]) => (
                <div key={lId} style={{ display: "flex", gap: "1.2rem", alignItems: "baseline" }}>
                  <EditableNode id={lId} tag="span" style={{ ...mono(9), color: C.accent, minWidth: 56, fontWeight: 600 }}>
                    <EditableText id={lId} display="inline" />
                  </EditableNode>
                  <EditableNode id={vId} tag="span" style={{ fontFamily: SANS, fontSize: 13.5, color: C.fg }}>
                    <EditableText id={vId} display="inline" />
                  </EditableNode>
                </div>
              ))}
            </div>
          </div>
          <MeridianContactForm />
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer id="section-footer" style={{ padding: `1.8rem ${px}`, borderTop: `1px solid ${C.line}`, display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "flex-start" : "center", justifyContent: "space-between", gap: "0.9rem" }}>
        <Brand nodeId="mrd-footer-brand" size={15} />
        <EditableNode id="mrd-footer-copy" tag="span" style={{ ...mono(9), color: C.muted }}>
          <EditableText id="mrd-footer-copy" display="inline" />
        </EditableNode>
        {perfil.ubicacion && <span style={{ ...mono(9), color: C.muted }}>{perfil.ubicacion}</span>}
      </footer>

      {readOnly && lightboxIdx !== null && (
        <Lightbox works={grid.loadMore ? pagedWorks : (grid.layout === "mosaic" ? featured : pagedWorks)} startIndex={lightboxIdx} onClose={() => setLightboxIdx(null)} />
      )}
    </div>
  );
}
