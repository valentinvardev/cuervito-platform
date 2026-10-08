"use client";

/**
 * Vernissage — la noche de apertura de una muestra: paredes oscuras, un cono
 * de luz sobre la foto del frente, marcos de nogal con filete de bronce. Las
 * fotos pasan en un carrusel 3D (coverflow) hecho sólo con CSS: perspective y
 * preserve-3d, sin WebGL ni dependencias.
 *
 * Viene de photo-saas (components/editor/canvas/VernissageTemplate.tsx). Lo
 * que cambió al traerla:
 *  - Sin fotos de demo: el carrusel muestra las del portfolio, con el evento
 *    de cada una como epígrafe.
 *  - El formulario manda la consulta por store.enviarConsulta, no por tRPC.
 *  - Todo el texto fijo, en castellano.
 *
 * Lo responsive sale de la prop `viewport` (la geometría del escenario
 * cambia por dispositivo).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useEditorStore } from "../store";
import { campo, fillWaTemplate } from "../whatsapp";
import type { Viewport } from "../tipos";
import { EditableNode, EditableText, EditableImage, LogoImage } from "../primitivas";

/* ── Design tokens — resolve the Design-panel variables ── */
const C = {
  bg:     "var(--ed-bg, #14171D)",
  fg:     "var(--ed-fg, #EDEBE4)",
  accent: "var(--ed-accent, #C2A15E)",
  muted:  "var(--ed-muted, #8A8E96)",
  line:   "color-mix(in srgb, var(--ed-fg, #EDEBE4) 14%, transparent)",
  body:   "color-mix(in srgb, var(--ed-fg, #EDEBE4) 84%, var(--ed-bg, #14171D))",
  raised: "color-mix(in srgb, var(--ed-fg, #EDEBE4) 5%, var(--ed-bg, #14171D))",
};
/* Physical materials — deliberately NOT palette-driven, so the hang reads as
   real objects on any wall colour: warm mat, walnut frame, crimson sold-dot. */
const MAT    = "#FAF8F2";
const WALNUT = "#2B261F";
const SOLD   = "#C43D2B";
const SERIF = "var(--tpl-serif, 'Fraunces', Georgia, serif)";
const SANS  = "var(--tpl-sans, 'Space Grotesk', system-ui, sans-serif)";
const MONO  = "var(--tpl-mono, 'Space Mono', ui-monospace, monospace)";

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

/* ── Clickable — real control on the live site, plain span in the editor ── */
function Clickable({ kind = "button", href, onActivate, style, children }: {
  kind?: "button" | "a";
  href?: string;
  onActivate?: () => void;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const readOnly = useEditorStore((s) => s.readOnly);
  const base: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 10, ...style };
  if (!readOnly) return <span style={{ ...base, cursor: "default" }}>{children}</span>;
  if (kind === "a") return <a href={href} style={{ ...base, textDecoration: "none" }}>{children}</a>;
  return <button onClick={onActivate} style={{ ...base, cursor: "pointer" }}>{children}</button>;
}

const btnSolid: React.CSSProperties = {
  fontFamily: SANS, fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase",
  color: "var(--ed-btn-fg, var(--ed-bg, #14171D))", background: "var(--ed-btn-bg, var(--ed-fg, #EDEBE4))",
  border: "1px solid var(--ed-btn-bg, var(--ed-fg, #EDEBE4))", borderRadius: "var(--ed-btn-radius, 0)",
  padding: "13px 26px",
};
const btnGhost: React.CSSProperties = {
  fontFamily: SANS, fontSize: 12, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase",
  color: C.fg, background: "transparent", border: `1px solid ${C.line}`,
  borderRadius: "var(--ed-btn-radius, 0)", padding: "13px 26px",
};

function Label({ index, nodeId, isMobile }: { index: string; nodeId: string; isMobile: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: isMobile ? 26 : 40 }}>
      <span style={{ ...mono(10), color: C.accent, fontWeight: 700 }}>{index}</span>
      <div style={{ flex: 1, height: 1, background: C.line }} />
      <EditableNode id={nodeId} tag="span" style={{ ...mono(10), color: C.muted }}>
        <EditableText id={nodeId} display="inline" />
      </EditableNode>
    </div>
  );
}

/* ═══════════════════════════════════════════
   THE 3D SHOWCASE (coverflow)
   Active work faces the visitor; neighbours recede at an angle.
═══════════════════════════════════════════ */
function Showcase({ works, viewport, onOpen, onViewAll }: { works: Work[]; viewport: Viewport; onOpen: (i: number) => void; onViewAll: () => void }) {
  const readOnly   = useEditorStore((s) => s.readOnly);
  const selectedId = useEditorStore((s) => s.selectedId);
  const isMobile = viewport === "mobile";
  const isTablet = viewport === "tablet";

  const N = works.length;           // artworks
  const LAST = N;                   // index of the closing card
  const [active, setActive] = useState(0);
  const clampTo = (i: number) => Math.max(0, Math.min(i, LAST));
  const go = (d: number) => setActive((a) => clampTo(a + d));

  /* Stage geometry */
  const H      = isMobile ? 470 : isTablet ? 560 : 640;  // stage height
  const AW     = isMobile ? 220 : isTablet ? 290 : 340;  // artwork plate width
  const AH     = isMobile ? 285 : isTablet ? 375 : 440;  // artwork plate height
  const SPREAD = isMobile ? 120 : isTablet ? 170 : 210;  // x-shift per step
  const ANGLE  = 42;                                     // side tilt (deg)

  /* Editor nicety: selecting a closing-card node navigates the showcase to it. */
  useEffect(() => {
    if (!readOnly && (selectedId === "vrn-endwall-title" || selectedId === "vrn-endwall-cta")) {
      setActive(LAST);
    }
  }, [readOnly, selectedId, LAST]);

  /* Drag / swipe — horizontal; vertical stays free for page scroll. */
  const drag = useRef<{ x: number; moved: boolean } | null>(null);
  const draggedRef = useRef(false);
  const [dragDx, setDragDx] = useState(0);
  const onPointerDown = (e: React.PointerEvent) => { drag.current = { x: e.clientX, moved: false }; };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x;
    if (Math.abs(dx) > 6) { drag.current.moved = true; draggedRef.current = true; }
    if (drag.current.moved) setDragDx(dx);
  };
  const onPointerUp = () => {
    if (drag.current?.moved) {
      const dx = dragDx;
      if (dx < -55) go(1);
      else if (dx > 55) go(-1);
    }
    drag.current = null;
    setDragDx(0);
    setTimeout(() => { draggedRef.current = false; }, 0);
  };

  /* Wheel — live site only, so the editor canvas scroll is never hijacked. */
  const vpRef = useRef<HTMLDivElement>(null);
  const wheelAcc = useRef(0);
  useEffect(() => {
    if (!readOnly) return;
    const el = vpRef.current;
    if (!el) return;
    const fn = (e: WheelEvent) => {
      e.preventDefault();
      wheelAcc.current += e.deltaY + e.deltaX;
      if (Math.abs(wheelAcc.current) > 90) {
        go(wheelAcc.current > 0 ? 1 : -1);
        wheelAcc.current = 0;
      }
    };
    el.addEventListener("wheel", fn, { passive: false });
    return () => el.removeEventListener("wheel", fn);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly, LAST]);

  /* Slide transform from its offset to the active index */
  function slideStyle(i: number): React.CSSProperties {
    const d = i - active;
    const abs = Math.abs(d);
    const front = d === 0;
    const x = d * SPREAD;
    const z = front ? 0 : -(170 + Math.min(abs, 3) * 80);
    const r = front ? 0 : d < 0 ? ANGLE : -ANGLE;
    return {
      position: "absolute", left: "50%", top: "46%", width: AW, height: AH,
      transform: `translate(-50%, -50%) translateX(${x}px) translateZ(${z}px) rotateY(${r}deg)`,
      transition: drag.current?.moved ? "transform 0.2s ease, opacity 0.2s ease" : "transform 0.6s cubic-bezier(0.22,1,0.36,1), opacity 0.45s ease",
      opacity: abs > 3 ? 0 : 1 - abs * 0.1,
      pointerEvents: abs > 3 ? "none" : "auto",
      zIndex: 100 - abs,
      transformStyle: "preserve-3d",
      cursor: front ? (readOnly ? "zoom-in" : "default") : "pointer",
    };
  }

  const counterNo = Math.min(active + 1, N);

  return (
    <div
      ref={vpRef}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={onPointerUp}
      style={{
        position: "relative", height: H, overflow: "hidden", background: C.bg,
        borderTop: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}`,
        touchAction: "pan-y", userSelect: "none",
      }}
    >
      {/* Night-wall vignette — the room falls into shadow at the edges */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none",
        background: `radial-gradient(120% 95% at 50% 32%, color-mix(in srgb, var(--ed-fg, #EDEBE4) 5%, var(--ed-bg, #14171D)) 0%, var(--ed-bg, #14171D) 52%, color-mix(in srgb, #000 32%, var(--ed-bg, #14171D)) 100%)` }} />

      {/* Spotlight — the cone of light that puts the frontal work on stage */}
      <div style={{ position: "absolute", left: "50%", top: 0, transform: "translateX(-50%)",
        width: AW * 2.2, height: "56%", pointerEvents: "none",
        clipPath: "polygon(41% 0, 59% 0, 100% 100%, 0 100%)",
        background: `linear-gradient(180deg, color-mix(in srgb, var(--ed-fg, #EDEBE4) 15%, transparent) 0%, color-mix(in srgb, var(--ed-fg, #EDEBE4) 5%, transparent) 62%, transparent 100%)` }} />

      {/* Stage — nudge follows the finger while dragging */}
      <div style={{ position: "absolute", inset: 0, perspective: isMobile ? 850 : 1200, perspectiveOrigin: "50% 44%",
        transform: `translateX(${dragDx / 4}px)`, transition: drag.current?.moved ? "none" : "transform 0.4s ease" }}>
        <div style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d" }}>

          {/* Artwork slides */}
          {works.map((w, i) => {
            const front = i === active;
            return (
              <div key={w.id} style={slideStyle(i)}
                onClick={() => {
                  if (draggedRef.current) return;
                  if (front) onOpen(i);
                  else setActive(i);
                }}>
                {/* Walnut frame + brass fillet + warm mat — spotlit when frontal */}
                <div style={{
                  position: "absolute", inset: 0, background: MAT,
                  border: `10px solid ${WALNUT}`,
                  boxShadow: front
                    ? `inset 0 0 0 1px var(--ed-accent, #C2A15E), 0 42px 74px -22px rgba(0,0,0,0.7)`
                    : `inset 0 0 0 1px color-mix(in srgb, var(--ed-accent, #C2A15E) 45%, transparent), 0 24px 44px -20px rgba(0,0,0,0.55)`,
                  padding: isMobile ? 10 : 15, boxSizing: "border-box",
                }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={w.src} alt={w.title ?? ""} loading="lazy"
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block",
                      filter: front ? "none" : "brightness(0.55) saturate(0.9)",
                      transition: "filter 0.6s ease" }} />
                </div>
              </div>
            );
          })}

          {/* Closing card — "view all work": a mosaic teaser that opens the
              full gallery. Frontal when active, so its text edits normally. */}
          <div style={{ ...slideStyle(LAST), background: C.raised, border: `1px solid ${C.line}`,
            boxShadow: active === LAST ? "0 42px 74px -22px rgba(0,0,0,0.6)" : "0 24px 44px -20px rgba(0,0,0,0.45)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: isMobile ? 12 : 16, padding: "8%", boxSizing: "border-box", textAlign: "center", cursor: active === LAST ? "default" : "pointer" }}
            onClick={() => { if (!draggedRef.current && active !== LAST) setActive(LAST); }}>
            {/* Mosaic teaser — a glimpse of the full collection */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4, width: "72%" }}>
              {works.slice(0, 6).map((w) => (
                <div key={w.id} style={{ position: "relative", aspectRatio: "1 / 1", overflow: "hidden", border: `1px solid ${C.line}` }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={w.src} alt="" loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.8)" }} />
                </div>
              ))}
            </div>
            <EditableNode id="vrn-endwall-title" tag="h2" style={{ fontFamily: SERIF, fontWeight: 500, fontSize: isMobile ? 17 : 23, lineHeight: 1.15, letterSpacing: "-0.01em", color: C.fg, margin: 0 }}>
              <EditableText id="vrn-endwall-title" />
            </EditableNode>
            <Clickable onActivate={onViewAll} style={{ ...btnSolid, padding: "11px 20px", fontSize: 11 }}>
              <EditableNode id="vrn-endwall-cta" tag="span"><EditableText id="vrn-endwall-cta" display="inline" /></EditableNode>
            </Clickable>
          </div>
        </div>
      </div>

      {/* Pool of light where the spotlight meets the floor */}
      <div style={{ position: "absolute", left: "50%", bottom: isMobile ? 46 : 52, transform: "translateX(-50%)",
        width: AW * 1.8, height: 34, borderRadius: "50%", pointerEvents: "none",
        background: "radial-gradient(50% 50% at 50% 50%, color-mix(in srgb, var(--ed-fg, #EDEBE4) 14%, transparent), transparent 70%)" }} />

      {/* Swipe hint — fades after the first move */}
      <div style={{
        position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)",
        ...mono(9), color: C.muted, background: "color-mix(in srgb, var(--ed-bg, #14171D) 82%, transparent)",
        border: `1px solid ${C.line}`, padding: "6px 12px", pointerEvents: "none",
        opacity: active > 0 ? 0 : 1, transition: "opacity 0.5s ease",
      }}>
        Deslizá o usá las flechas →
      </div>

      {/* HUD — counter, progress, arrows */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, display: "flex", alignItems: "center", gap: 14, padding: isMobile ? "10px 14px" : "12px 22px", background: "color-mix(in srgb, var(--ed-bg, #14171D) 88%, transparent)", borderTop: `1px solid ${C.line}`, backdropFilter: "blur(6px)" }}>
        <span style={{ ...mono(9), color: C.fg, fontWeight: 700, flexShrink: 0 }}>
          {active === LAST ? "Fin" : `${String(counterNo).padStart(2, "0")}/${String(N).padStart(2, "0")}`}
        </span>
        <div style={{ flex: 1, height: 2, background: C.line, position: "relative" }}>
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${LAST > 0 ? (active / LAST) * 100 : 100}%`, background: C.accent, transition: "width 0.5s cubic-bezier(0.22,1,0.36,1)" }} />
        </div>
        {[{ d: -1, g: "‹" }, { d: 1, g: "›" }].map((b) => (
          <button key={b.g} onClick={(e) => { e.stopPropagation(); go(b.d); }} aria-label={b.d < 0 ? "Anterior" : "Siguiente"}
            style={{ width: 36, height: 36, borderRadius: "50%", border: `1px solid ${C.line}`, background: "transparent", color: C.fg, fontSize: 17, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontFamily: SANS }}>
            {b.g}
          </button>
        ))}
      </div>
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
    background: "rgba(237,235,228,0.06)", border: "1px solid rgba(237,235,228,0.18)",
    color: "rgba(237,235,228,0.85)", borderRadius: "50%",
  };
  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(10,11,12,0.96)", display: "flex", alignItems: "center", justifyContent: "center", padding: "56px 64px" }}>
      <button onClick={onClose} style={{ position: "absolute", top: 20, right: 24, background: "none", border: "none", cursor: "pointer", color: "rgba(237,235,228,0.7)", ...mono(11) }}>Cerrar ✕</button>
      {index > 0 && <button onClick={() => setIndex((i) => i - 1)} style={{ ...arrow, left: 16 }} aria-label="Anterior">←</button>}
      {index < works.length - 1 && <button onClick={() => setIndex((i) => i + 1)} style={{ ...arrow, right: 16 }} aria-label="Siguiente">→</button>}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={w.src} alt={w.title ?? ""} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
      <div style={{ position: "absolute", bottom: 20, left: 0, right: 0, display: "flex", justifyContent: "space-between", padding: "0 32px", color: "rgba(237,235,228,0.6)" }}>
        <span style={mono(10)}>{String(index + 1).padStart(2, "0")} / {String(works.length).padStart(2, "0")}</span>
        {w.title && <span style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 15, color: "rgba(237,235,228,0.85)" }}>{w.title}</span>}
        <span />
      </div>
    </div>
  );
}

/* ── Gallery modal — every work in the collection (live site only) ── */
function GalleryModal({ works, onOpen, onClose }: { works: Work[]; onOpen: (i: number) => void; onClose: () => void }) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1900, background: "rgba(10,11,12,0.97)", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 28px", borderBottom: "1px solid rgba(237,235,228,0.12)", flexShrink: 0 }}>
        <span style={{ ...mono(10), color: "rgba(237,235,228,0.85)", display: "inline-flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--ed-accent, #C2A15E)", display: "inline-block" }} />
          Todas las fotos
        </span>
        <span style={{ ...mono(10), color: "rgba(237,235,228,0.45)" }}>{String(works.length).padStart(2, "0")} {works.length === 1 ? "foto" : "fotos"}</span>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(237,235,228,0.7)", ...mono(11) }}>Cerrar ✕</button>
      </div>
      {/* Grid */}
      <div style={{ flex: 1, overflowY: "auto", padding: "28px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16, maxWidth: 1280, margin: "0 auto" }}>
          {works.map((w, i) => (
            <div key={w.id} onClick={() => onOpen(i)}
              style={{ position: "relative", aspectRatio: "4 / 5", overflow: "hidden", cursor: "zoom-in", background: "#0e1013", border: "1px solid rgba(237,235,228,0.1)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={w.src} alt={w.title ?? ""} loading="lazy"
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.92)", transition: "filter 0.25s ease, transform 0.35s ease" }}
                onMouseEnter={(e) => { e.currentTarget.style.filter = "brightness(1)"; e.currentTarget.style.transform = "scale(1.03)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.filter = "brightness(0.92)"; e.currentTarget.style.transform = "scale(1)"; }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Contact form — follows store.contact (inbox vs WhatsApp) ── */
function VernissageContactForm() {
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
    if (!readOnly) return;
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
export function VernissagePlantilla({ viewport }: { viewport: Viewport }) {
  const { selectNode, logo, grid, readOnly, perfil } = useEditorStore();
  const isMobile = viewport === "mobile";
  const isTablet = viewport === "tablet";
  const px = isMobile ? "1.35rem" : isTablet ? "4vw" : "6vw";

  const works = useWorks();
  const roomWorks = works.slice(0, 12);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const openLightbox = (i: number) => { if (readOnly) setLightboxIdx(i); };

  /* Flat fallback layouts (Design > Grid) */
  const cols = isMobile ? Math.min(grid.columns, 2) : isTablet ? Math.min(grid.columns, 3) : grid.columns;
  const [visibleCount, setVisibleCount] = useState(grid.pageSize);
  useEffect(() => { setVisibleCount(grid.pageSize); }, [grid.pageSize, grid.loadMore, grid.layout, works.length]);
  const pagedWorks  = grid.loadMore ? works.slice(0, visibleCount) : works.slice(0, 9);
  const canLoadMore = grid.loadMore && visibleCount < works.length;

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  function Brand({ nodeId, size = 14 }: { nodeId: string; size?: number }) {
    const textEl = (
      <EditableNode id={nodeId} tag="span" style={{ ...mono(size), color: C.fg, fontWeight: 700, letterSpacing: "0.3em" }}>
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
    { id: "vrn-nav-item-1", fn: () => scrollTo("vrn-gallery") },
    { id: "vrn-nav-item-2", fn: () => scrollTo("vrn-about") },
    { id: "vrn-nav-item-3", fn: () => scrollTo("vrn-contact") },
  ];

  return (
    <div onClick={() => selectNode(null)}
      style={{ background: C.bg, color: C.fg, minHeight: "100%", fontFamily: SANS }}>

      {/* ── NAV ── */}
      <nav id="section-nav" style={{ position: "relative", zIndex: 50, display: "flex", alignItems: "center", height: isMobile ? 58 : 72, padding: `0 ${px}`, borderBottom: `1px solid ${C.line}`, background: C.bg }}>
        <Brand nodeId="vrn-nav-brand" size={isMobile ? 11 : 12} />
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 14 : 28, marginLeft: "auto" }}>
          {!isMobile && navItems.map((item) => (
            <Clickable key={item.id} onActivate={item.fn}
              style={{ background: "none", border: "none", padding: 0, fontFamily: SANS, fontSize: 12, fontWeight: 500, letterSpacing: "0.06em", color: C.fg, opacity: 0.65 }}>
              <EditableNode id={item.id} tag="span"><EditableText id={item.id} display="inline" /></EditableNode>
            </Clickable>
          ))}
          <Clickable onActivate={() => scrollTo("vrn-contact")} style={{ ...btnSolid, padding: isMobile ? "9px 16px" : "10px 18px", fontSize: 11 }}>
            <EditableNode id="vrn-nav-cta" tag="span"><EditableText id="vrn-nav-cta" display="inline" /></EditableNode>
          </Clickable>
        </div>
      </nav>

      {/* ── POSTER (hero) — a soft spot warms the title out of the dark ── */}
      <section id="vrn-hero" style={{ position: "relative", padding: `${isMobile ? "3.5rem" : "6rem"} ${px} ${isMobile ? "3rem" : "5rem"}`, textAlign: "center", maxWidth: 1000, margin: "0 auto" }}>
        <div aria-hidden style={{ position: "absolute", left: "50%", top: 0, transform: "translateX(-50%)", width: 780, maxWidth: "100%", height: "78%", pointerEvents: "none",
          background: "radial-gradient(50% 58% at 50% 40%, color-mix(in srgb, var(--ed-fg, #EDEBE4) 7%, transparent), transparent 72%)" }} />
        <EditableNode id="vrn-hero-eyebrow" tag="span" style={{ ...mono(10), color: C.accent, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 8, marginBottom: isMobile ? 22 : 32 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: C.accent, display: "inline-block" }} />
          <EditableText id="vrn-hero-eyebrow" display="inline" />
        </EditableNode>

        <EditableNode id="vrn-hero-title" tag="h1" style={{ fontFamily: SERIF, fontWeight: 500, fontSize: isMobile ? "clamp(46px,13vw,68px)" : "clamp(64px,7vw,120px)", lineHeight: 0.98, letterSpacing: "-0.025em", color: C.fg, margin: `0 0 ${isMobile ? "1.2rem" : "1.8rem"}` }}>
          <EditableText id="vrn-hero-title" />
        </EditableNode>

        <EditableNode id="vrn-hero-dates" tag="div" style={{ ...mono(10), color: C.muted, marginBottom: isMobile ? "1.4rem" : "2rem" }}>
          <EditableText id="vrn-hero-dates" display="inline" />
        </EditableNode>

        <EditableNode id="vrn-hero-sub" style={{ fontFamily: SANS, fontSize: 15, lineHeight: 1.75, color: C.body, maxWidth: 520, margin: "0 auto", marginBottom: isMobile ? "1.8rem" : "2.4rem" }}>
          <EditableText id="vrn-hero-sub" />
        </EditableNode>

        <Clickable onActivate={() => scrollTo("vrn-gallery")} style={btnSolid}>
          <EditableNode id="vrn-hero-cta" tag="span"><EditableText id="vrn-hero-cta" display="inline" /></EditableNode>
          <span aria-hidden>↓</span>
        </Clickable>
      </section>

      {/* ── 3D SHOWCASE ── */}
      <section id="vrn-gallery" style={{ paddingTop: isMobile ? "1.5rem" : "2.5rem" }}>
        <div style={{ padding: `0 ${px}` }}>
          <Label index="01" nodeId="vrn-gallery-label" isMobile={isMobile} />
          <EditableNode id="vrn-gallery-note" style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: isMobile ? 16 : 19, color: C.body, maxWidth: 560, marginBottom: isMobile ? "1.6rem" : "2.4rem" }}>
            <EditableText id="vrn-gallery-note" />
          </EditableNode>
        </div>

        {grid.layout === "corridor" ? (
          <Showcase works={roomWorks} viewport={viewport} onOpen={openLightbox} onViewAll={() => { if (readOnly) setGalleryOpen(true); }} />
        ) : (
          /* Flat fallbacks so the Grid panel choice is honoured */
          <div style={{ padding: `0 ${px} ${isMobile ? "1rem" : "2rem"}` }}>
            {grid.layout === "masonry" ? (
              <div style={{ columnCount: cols, columnGap: grid.gap }}>
                {pagedWorks.map((w, i) => (
                  <div key={w.id} style={{ breakInside: "avoid", marginBottom: grid.gap, cursor: "pointer", background: C.raised }} onClick={() => openLightbox(i)}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={w.src} alt={w.title ?? ""} loading="lazy" style={{ width: "100%", height: "auto", display: "block" }} />
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: grid.gap }}>
                {pagedWorks.map((w, i) => (
                  <div key={w.id} style={{ position: "relative", aspectRatio: isMobile ? "1 / 1" : "4 / 5", overflow: "hidden", cursor: "pointer", background: C.raised }} onClick={() => openLightbox(i)}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={w.src} alt={w.title ?? ""} loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: grid.fit, display: "block" }} />
                  </div>
                ))}
              </div>
            )}
            {canLoadMore && (
              <div style={{ marginTop: "2rem", display: "flex", justifyContent: "center" }}>
                <button onClick={() => setVisibleCount((c) => c + grid.pageSize)} style={{ ...btnGhost, cursor: "pointer" }}>Ver más ↓</button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── ARTIST ── */}
      <section id="vrn-about" style={{ padding: `${isMobile ? "3.5rem" : "6rem"} ${px}` }}>
        <Label index="02" nodeId="vrn-about-label" isMobile={isMobile} />
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(240px, 340px) 1fr", gap: isMobile ? "2.2rem" : "4.5rem", alignItems: "start" }}>
          <EditableNode id="vrn-about-image" style={{ position: "relative", width: "100%", maxWidth: isMobile ? 300 : undefined, aspectRatio: "4 / 5", overflow: "hidden", background: MAT, border: `9px solid ${WALNUT}`, padding: 10, boxSizing: "border-box", boxShadow: "inset 0 0 0 1px var(--ed-accent, #C2A15E), 0 26px 50px -20px rgba(0,0,0,0.6)" }}>
            <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
              <EditableImage id="vrn-about-image" imgStyle={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            </div>
          </EditableNode>
          <div>
            <EditableNode id="vrn-about-heading" tag="h2" style={{ fontFamily: SERIF, fontWeight: 500, fontSize: isMobile ? "clamp(28px,8.5vw,40px)" : "clamp(34px,3.4vw,52px)", lineHeight: 1.08, letterSpacing: "-0.015em", color: C.fg, margin: "0 0 1.3rem" }}>
              <EditableText id="vrn-about-heading" />
            </EditableNode>
            <EditableNode id="vrn-about-body" style={{ fontFamily: SANS, fontSize: 15, lineHeight: 1.8, color: C.body, maxWidth: 560, marginBottom: "2rem" }}>
              <EditableText id="vrn-about-body" />
            </EditableNode>
            <div style={{ display: "flex", gap: isMobile ? "1.8rem" : "3rem", paddingTop: "1.6rem", borderTop: `1px solid ${C.line}` }}>
              {([["vrn-stat-1-value","vrn-stat-1-label"],["vrn-stat-2-value","vrn-stat-2-label"],["vrn-stat-3-value","vrn-stat-3-label"]] as const).map(([vId, lId]) => (
                <div key={vId}>
                  <EditableNode id={vId} style={{ fontFamily: SERIF, fontSize: isMobile ? 26 : 32, fontWeight: 500, color: C.accent, lineHeight: 1 }}>
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
      <section id="vrn-contact" style={{ padding: `${isMobile ? "3.5rem" : "6rem"} ${px} ${isMobile ? "4rem" : "6.5rem"}`, borderTop: `1px solid ${C.line}`, background: C.raised }}>
        <Label index="03" nodeId="vrn-contact-label" isMobile={isMobile} />
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? "2.5rem" : "5rem", alignItems: "start" }}>
          <div>
            <EditableNode id="vrn-contact-heading" tag="h2" style={{ fontFamily: SERIF, fontWeight: 500, fontSize: isMobile ? "clamp(32px,9.5vw,44px)" : "clamp(38px,4vw,60px)", lineHeight: 1.05, letterSpacing: "-0.015em", color: C.fg, margin: "0 0 1.3rem" }}>
              <EditableText id="vrn-contact-heading" />
            </EditableNode>
            <EditableNode id="vrn-contact-body" style={{ fontFamily: SANS, fontSize: 14, lineHeight: 1.75, color: C.body, maxWidth: 420, marginBottom: "2rem" }}>
              <EditableText id="vrn-contact-body" />
            </EditableNode>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {([["vrn-contact-d1-label","vrn-contact-d1-value"],["vrn-contact-d2-label","vrn-contact-d2-value"],["vrn-contact-d3-label","vrn-contact-d3-value"]] as const).map(([lId, vId]) => (
                <div key={lId} style={{ display: "flex", gap: "1.2rem", alignItems: "baseline" }}>
                  <EditableNode id={lId} tag="span" style={{ ...mono(9), color: C.accent, minWidth: 56, fontWeight: 700 }}>
                    <EditableText id={lId} display="inline" />
                  </EditableNode>
                  <EditableNode id={vId} tag="span" style={{ fontFamily: SANS, fontSize: 13.5, color: C.fg }}>
                    <EditableText id={vId} display="inline" />
                  </EditableNode>
                </div>
              ))}
            </div>
          </div>
          <VernissageContactForm />
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer id="section-footer" style={{ padding: `1.8rem ${px}`, borderTop: `1px solid ${C.line}`, display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "flex-start" : "center", justifyContent: "space-between", gap: "0.9rem" }}>
        <Brand nodeId="vrn-footer-brand" size={10} />
        <EditableNode id="vrn-footer-copy" tag="span" style={{ ...mono(9), color: C.muted }}>
          <EditableText id="vrn-footer-copy" display="inline" />
        </EditableNode>
        <span style={{ ...mono(9), color: C.muted, display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: SOLD, display: "inline-block" }} />
          {perfil.ubicacion ?? "Temporada 2026"}
        </span>
      </footer>

      {readOnly && galleryOpen && (
        <GalleryModal works={works} onOpen={(i) => setLightboxIdx(i)} onClose={() => setGalleryOpen(false)} />
      )}
      {readOnly && lightboxIdx !== null && (
        <Lightbox works={galleryOpen ? works : grid.layout === "corridor" ? roomWorks : pagedWorks} startIndex={lightboxIdx} onClose={() => setLightboxIdx(null)} />
      )}
    </div>
  );
}
