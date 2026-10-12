"use client";

/**
 * Kilómetro — revista outdoor: arena, tinta y terracota, Manrope para todo y
 * esquinas redondeadas grandes.
 *
 * La portada va partida (el título a la izquierda, la foto vertical a la
 * derecha), las cifras en píldoras, el trabajo en carruseles que se deslizan
 * —uno por evento, con scroll-snap—, los eventos como tarjetas con su
 * portada, y el contacto en una caja terracota. El menú es un panel que entra
 * desde la derecha, y desde abajo en el celular.
 *
 * Lo responsive sale de `viewport` (data-vp), no de media queries, igual que
 * en las otras plantillas.
 */

import "./kilometro.css";

import { useRef, useState } from "react";

import { EditableImage, EditableNode, EditableText, LogoImage } from "../primitivas";
import { useEditorStore } from "../store";
import type { Viewport } from "../tipos";
import {
  aTexto,
  Clic,
  irA,
  Lineas,
  miles,
  partesFecha,
  useContacto,
  useContenido,
  useEnlaces,
  useMenu,
  useMovimientoReducido,
  useNodoVisible,
  useProyectos,
  useRevelar,
  useSeccionVisible,
  Visor,
  type FotoVisor,
} from "./comun";

const MAX_EVENTOS = 9;
const imagenLlena = { width: "100%", height: "100%", objectFit: "cover", display: "block" } as const;

const Flecha = ({ lado = "der" }: { lado?: "der" | "izq" | "diagonal" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={lado === "diagonal" ? "M7 17L17 7M9 7h8v8" : lado === "izq" ? "M19 12H5M11 6l-6 6 6 6" : "M5 12h14M13 6l6 6-6 6"} />
  </svg>
);

const Ruta = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="6" cy="19" r="2" />
    <circle cx="18" cy="5" r="2" />
    <path d="M8 19h7.5a3.5 3.5 0 000-7h-7a3.5 3.5 0 010-7H16" />
  </svg>
);

/* ── Marca ──────────────────────────────────────────────────────────────── */

function Marca({ nodeId }: { nodeId: string }) {
  const logo = useEditorStore((s) => s.logo);
  if (logo.mode === "image" && logo.imageUrl) {
    return <LogoImage src={logo.imageUrl} alt={logo.text} width={logo.width} crop={logo.imageCrop} />;
  }
  return (
    <span className="km-marca">
      {logo.mode === "image+text" && logo.imageUrl ? (
        <LogoImage src={logo.imageUrl} width={logo.width} crop={logo.imageCrop} />
      ) : (
        <span className="km-marca-sello">
          <Ruta />
        </span>
      )}
      <EditableNode id={nodeId} tag="span" className="km-marca-nombre">
        <EditableText id={nodeId} display="inline" />
      </EditableNode>
    </span>
  );
}

/* ── Nav y menú ─────────────────────────────────────────────────────────── */

type Enlace = { id: string; texto: string };

function Nav({ enlaces, alAbrir, abierto }: { enlaces: Enlace[]; alAbrir: () => void; abierto: boolean }) {
  const visible = useSeccionVisible();
  return (
    <nav id="section-nav" className="km-nav">
      <Marca nodeId="km-nav-brand" />
      <div className="km-nav-der">
        {enlaces.slice(0, 3).map((l) => (
          <Clic key={l.id} className="km-nav-link" alActivar={() => irA(l.id)}>
            {l.texto}
          </Clic>
        ))}
        {visible("km-contact") && (
          <Clic className="km-pill km-pill-acento km-nav-cta" alActivar={() => irA("km-contact")}>
            <EditableNode id="km-nav-cta" tag="span">
              <EditableText id="km-nav-cta" display="inline" />
            </EditableNode>
          </Clic>
        )}
        <Clic className="km-menu-btn" alActivar={alAbrir} etiqueta="Abrir el menú" expandido={abierto}>
          <span className="km-barras" aria-hidden>
            <i />
            <i />
          </span>
        </Clic>
      </div>
    </nav>
  );
}

function Menu({ menu, enlaces }: { menu: ReturnType<typeof useMenu>; enlaces: Enlace[] }) {
  const links = useEnlaces();
  return (
    <div
      ref={menu.panel}
      className="km-menu"
      data-abierto={menu.abierto ? "" : undefined}
      inert={!menu.abierto}
      role="dialog"
      aria-modal="true"
      aria-label="Menú"
      onClick={(e) => {
        if (e.target === e.currentTarget) menu.cerrar();
      }}
    >
      <div className="km-menu-panel">
        <div className="km-menu-cab">
          <Marca nodeId="km-nav-brand" />
          <button type="button" className="km-menu-cerrar" onClick={menu.cerrar} aria-label="Cerrar el menú">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <nav className="km-menu-links">
          {enlaces.map((l, i) => (
            <a
              key={l.id}
              href={`#${l.id}`}
              style={{ "--i": i } as React.CSSProperties}
              onClick={(e) => {
                e.preventDefault();
                menu.ir(l.id);
              }}
            >
              <span>{l.texto}</span>
              <Flecha />
            </a>
          ))}
        </nav>
        {(links.instagram ?? links.whatsapp ?? links.tienda) && (
          <div className="km-menu-pie">
            {links.instagram && <a href={links.instagram} target="_blank" rel="noopener noreferrer" className="km-pill km-pill-borde">Instagram ↗</a>}
            {links.whatsapp && <a href={links.whatsapp} target="_blank" rel="noopener noreferrer" className="km-pill km-pill-borde">WhatsApp ↗</a>}
            {links.tienda && <a href={links.tienda} className="km-pill km-pill-borde">Galerías ↗</a>}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Portada ────────────────────────────────────────────────────────────── */

function Portada() {
  const visible = useSeccionVisible();
  const conSello = useNodoVisible("km-hero-badge");
  return (
    <section id="km-hero" className="km-hero">
      <div className="km-hero-texto">
        <div className="km-hero-chips">
          <EditableNode id="km-hero-chip" tag="span" className="km-chip">
            <EditableText id="km-hero-chip" display="inline" />
          </EditableNode>
          <EditableNode id="km-hero-meta" tag="span" className="km-hero-meta">
            <EditableText id="km-hero-meta" display="inline" />
          </EditableNode>
        </div>
        <EditableNode id="km-hero-title" tag="h1" className="km-hero-titulo">
          <Lineas id="km-hero-title" className="km-linea" />
        </EditableNode>
        <EditableNode id="km-hero-sub" tag="p" className="km-hero-sub">
          <EditableText id="km-hero-sub" />
        </EditableNode>
        <div className="km-hero-ctas">
          <Clic className="km-pill km-pill-oscura" alActivar={() => irA("km-work")}>
            <EditableNode id="km-hero-cta-1" tag="span">
              <EditableText id="km-hero-cta-1" display="inline" />
            </EditableNode>
            <Flecha />
          </Clic>
          {visible("km-contact") && (
            <Clic className="km-pill km-pill-borde" alActivar={() => irA("km-contact")}>
              <EditableNode id="km-hero-cta-2" tag="span">
                <EditableText id="km-hero-cta-2" display="inline" />
              </EditableNode>
            </Clic>
          )}
        </div>
      </div>
      <div className="km-hero-foto">
        <div className="km-hero-marco">
          <EditableNode id="km-hero-image" style={{ position: "absolute", inset: 0 }}>
            <EditableImage id="km-hero-image" imgStyle={imagenLlena} />
          </EditableNode>
        </div>
        {conSello && (
          <EditableNode id="km-hero-badge" tag="span" className="km-hero-sello">
            <EditableText id="km-hero-badge" display="inline" />
          </EditableNode>
        )}
      </div>
    </section>
  );
}

/* ── Cifras ─────────────────────────────────────────────────────────────── */

function Cifra({ n }: { n: number }) {
  // Si el dato da cero, el valor queda oculto y la píldora no se dibuja.
  if (!useNodoVisible(`km-stat-${n}-value`)) return null;
  return (
    <div className="km-cifra" data-rv="" style={{ "--i": n - 1 } as React.CSSProperties}>
      <EditableNode id={`km-stat-${n}-value`} tag="span" className="km-cifra-valor">
        <EditableText id={`km-stat-${n}-value`} display="inline" />
      </EditableNode>
      <EditableNode id={`km-stat-${n}-label`} tag="span" className="km-cifra-rotulo">
        <EditableText id={`km-stat-${n}-label`} display="inline" />
      </EditableNode>
    </div>
  );
}

function Cifras() {
  const hay = [useNodoVisible("km-stat-1-value"), useNodoVisible("km-stat-2-value"), useNodoVisible("km-stat-3-value")];
  if (!hay.some(Boolean)) return null;
  return (
    <section id="km-cifras" className="km-cifras">
      <Cifra n={1} />
      <Cifra n={2} />
      <Cifra n={3} />
    </section>
  );
}

/* ── Trabajo ────────────────────────────────────────────────────────────── */

function Cabecera({ prefijo }: { prefijo: string }) {
  return (
    <div className="km-cab" data-rv="">
      <div className="km-cab-izq">
        <EditableNode id={`${prefijo}-label`} tag="span" className="km-rotulo">
          <EditableText id={`${prefijo}-label`} display="inline" />
        </EditableNode>
        <EditableNode id={`${prefijo}-heading`} tag="h2" className="km-h2">
          <EditableText id={`${prefijo}-heading`} />
        </EditableNode>
      </div>
      <EditableNode id={`${prefijo}-intro`} tag="p" className="km-cab-p">
        <EditableText id={`${prefijo}-intro`} />
      </EditableNode>
    </div>
  );
}

function Carrusel({
  titulo,
  fotos,
  indice,
  alAbrir,
}: {
  titulo: string;
  fotos: FotoVisor[];
  indice: number;
  alAbrir: (fotos: FotoVisor[], i: number) => void;
}) {
  const readOnly = useEditorStore((s) => s.readOnly);
  const reducido = useMovimientoReducido();
  const pista = useRef<HTMLDivElement>(null);
  const mover = (lado: 1 | -1) => {
    const el = pista.current;
    if (!el) return;
    el.scrollBy({ left: lado * el.clientWidth * 0.8, behavior: reducido ? "auto" : "smooth" });
  };
  return (
    <div className="km-fila" data-rv="">
      <div className="km-fila-cab">
        <span className="km-fila-n">{String(indice + 1).padStart(2, "0")}</span>
        <h3 className="km-fila-t">{titulo}</h3>
        <span className="km-fila-cant">{miles(fotos.length)} {fotos.length === 1 ? "foto" : "fotos"}</span>
        {readOnly && fotos.length > 2 && (
          <span className="km-fila-flechas">
            <button type="button" onClick={() => mover(-1)} aria-label={`Fotos anteriores de ${titulo}`}>
              <Flecha lado="izq" />
            </button>
            <button type="button" onClick={() => mover(1)} aria-label={`Más fotos de ${titulo}`}>
              <Flecha />
            </button>
          </span>
        )}
      </div>
      <div ref={pista} className="km-pista">
        {fotos.map((f, i) => (
          <Clic
            key={`${f.src}-${i}`}
            className="km-foto"
            etiqueta={`Ver la foto ${i + 1} de ${titulo}`}
            alActivar={() => alAbrir(fotos, i)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={f.src} alt="" loading="lazy" />
          </Clic>
        ))}
      </div>
    </div>
  );
}

function Trabajo({ alAbrir }: { alAbrir: (fotos: FotoVisor[], i: number) => void }) {
  const proyectos = useProyectos();
  return (
    <section id="km-work" className="km-trabajo">
      <Cabecera prefijo="km-work" />
      {proyectos.length === 0 ? (
        <p className="km-vacio">Las fotos que elijas para el portfolio aparecen acá, una fila por evento.</p>
      ) : (
        <div className="km-filas">
          {proyectos.map((p, i) => (
            <Carrusel
              key={p.id}
              titulo={p.title}
              indice={i}
              fotos={p.photos.map((f) => ({ src: f.src, titulo: p.title }))}
              alAbrir={alAbrir}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/* ── Eventos ────────────────────────────────────────────────────────────── */

function Eventos() {
  const eventos = useEditorStore((s) => s.perfil.eventos) ?? [];
  const readOnly = useEditorStore((s) => s.readOnly);
  const { tienda } = useEnlaces();
  if (eventos.length === 0 && readOnly) return null;
  const lista = eventos.slice(0, MAX_EVENTOS);

  return (
    <section id="km-events" className="km-eventos">
      <Cabecera prefijo="km-events" />
      {lista.length === 0 ? (
        <p className="km-vacio">Cuando publiques eventos, aparecen acá con el link a su galería.</p>
      ) : (
        <div className="km-tarjetas">
          {lista.map((e, i) => {
            const f = partesFecha(e.fecha);
            const datos = [e.disciplina, e.lugar].filter(Boolean).join(" · ");
            return (
              <Clic key={e.href} href={e.href} className="km-tarjeta" data-rv="" style={{ "--i": i % 3 } as React.CSSProperties}>
                <span className="km-tarjeta-foto">
                  {e.portada ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={e.portada} alt="" loading="lazy" />
                  ) : (
                    <span className="km-tarjeta-sin" aria-hidden>
                      <Ruta />
                    </span>
                  )}
                  {f && (
                    <span className="km-tarjeta-fecha">
                      {f.dia} {f.mes} {f.anio}
                    </span>
                  )}
                </span>
                <span className="km-tarjeta-txt">
                  <span className="km-tarjeta-t">{e.nombre}</span>
                  {datos && <span className="km-tarjeta-d">{datos}</span>}
                </span>
                <span className="km-tarjeta-pie">
                  <span>{miles(e.fotos)} {e.fotos === 1 ? "foto" : "fotos"}</span>
                  <span className="km-tarjeta-flecha">
                    <Flecha lado="diagonal" />
                  </span>
                </span>
              </Clic>
            );
          })}
        </div>
      )}
      {eventos.length > lista.length && tienda && (
        <div className="km-mas">
          <Clic className="km-pill km-pill-borde" href={tienda}>
            Ver los {eventos.length} eventos en encontrate ↗
          </Clic>
        </div>
      )}
    </section>
  );
}

/* ── Sobre mí ───────────────────────────────────────────────────────────── */

function SobreMi() {
  const { instagram, tienda, web } = useEnlaces();
  return (
    <section id="km-about" className="km-sobre">
      <div className="km-sobre-foto" data-rv="">
        <EditableNode id="km-about-image" style={{ position: "absolute", inset: 0 }}>
          <EditableImage id="km-about-image" imgStyle={imagenLlena} />
        </EditableNode>
      </div>
      <div className="km-sobre-texto" data-rv="">
        <EditableNode id="km-about-label" tag="span" className="km-rotulo">
          <EditableText id="km-about-label" display="inline" />
        </EditableNode>
        <EditableNode id="km-about-heading" tag="h2" className="km-sobre-h">
          <EditableText id="km-about-heading" />
        </EditableNode>
        <EditableNode id="km-about-body" tag="p" className="km-sobre-p">
          <EditableText id="km-about-body" />
        </EditableNode>
        {(instagram ?? tienda ?? web) && (
          <div className="km-sobre-links">
            {instagram && <Clic className="km-pill km-pill-oscura" href={instagram} externo>Instagram ↗</Clic>}
            {tienda && <Clic className="km-pill km-pill-borde" href={tienda}>Galerías en encontrate ↗</Clic>}
            {web && <Clic className="km-pill km-pill-borde" href={web} externo>Web ↗</Clic>}
          </div>
        )}
      </div>
    </section>
  );
}

/* ── Contacto y pie ─────────────────────────────────────────────────────── */

function Contacto() {
  const { estado, alEnviar, porWhatsapp, readOnly } = useContacto();
  return (
    <section id="km-contact" className="km-contacto">
      <div className="km-contacto-caja">
        <div className="km-contacto-texto">
          <EditableNode id="km-contact-label" tag="span" className="km-rotulo km-rotulo-claro">
            <EditableText id="km-contact-label" display="inline" />
          </EditableNode>
          <EditableNode id="km-contact-heading" tag="h2" className="km-contacto-h">
            <EditableText id="km-contact-heading" />
          </EditableNode>
          <EditableNode id="km-contact-body" tag="p" className="km-contacto-p">
            <EditableText id="km-contact-body" />
          </EditableNode>
        </div>
        {estado === "enviado" ? (
          <div className="km-enviado" role="status">
            <span className="km-enviado-ok" aria-hidden>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
            </span>
            <span>{porWhatsapp ? "Abriendo WhatsApp…" : "Listo, te respondo en el día."}</span>
          </div>
        ) : (
          <form className="km-form" onSubmit={alEnviar}>
            <label className="km-campo">
              <span>Nombre</span>
              <input name="name" required placeholder="Tu nombre o el de la organización" autoComplete="name" disabled={!readOnly} />
            </label>
            <label className="km-campo">
              <span>Email</span>
              <input name="email" type="email" required placeholder="tu@mail.com" autoComplete="email" disabled={!readOnly} />
            </label>
            <label className="km-campo km-campo-alto">
              <span>La carrera</span>
              <textarea name="message" required rows={3} placeholder="Fecha, lugar, distancia…" disabled={!readOnly} />
            </label>
            {estado === "error" && <p className="km-form-error">No se pudo mandar. Probá de nuevo.</p>}
            <button type="submit" className="km-pill km-pill-oscura km-enviar" disabled={estado === "mandando" || !readOnly}>
              {estado === "mandando" ? "Mandando…" : porWhatsapp ? "Mandar por WhatsApp" : "Mandar consulta"}
              <Flecha />
            </button>
          </form>
        )}
      </div>
    </section>
  );
}

function Pie() {
  const { instagram, whatsapp } = useEnlaces();
  return (
    <footer id="section-footer" className="km-pie">
      <EditableNode id="km-footer-brand" tag="span" className="km-pie-marca">
        <EditableText id="km-footer-brand" display="inline" />
      </EditableNode>
      <div className="km-pie-links">
        {instagram && <Clic href={instagram} externo>Instagram</Clic>}
        {whatsapp && <Clic href={whatsapp} externo>WhatsApp</Clic>}
        <Clic alActivar={() => irA("km-hero")}>Volver arriba ↑</Clic>
      </div>
      <span className="km-pie-copy">
        <EditableNode id="km-footer-copy" tag="span">
          <EditableText id="km-footer-copy" display="inline" />
        </EditableNode>
        <span> · Hecho con encontrate</span>
      </span>
    </footer>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */

export function KilometroPlantilla({ viewport }: { viewport: Viewport }) {
  const selectNode = useEditorStore((s) => s.selectNode);
  const readOnly = useEditorStore((s) => s.readOnly);
  const galeria = useEditorStore((s) => s.galleryPhotos);
  const eventos = useEditorStore((s) => s.perfil.eventos);
  const visible = useSeccionVisible();
  const menu = useMenu();
  const raiz = useRef<HTMLDivElement>(null);
  const [visor, setVisor] = useState<{ fotos: FotoVisor[]; i: number } | null>(null);

  const tTrabajo = aTexto(useContenido("km-work-label"));
  const tEventos = aTexto(useContenido("km-events-label"));
  const tSobre = aTexto(useContenido("km-about-label"));
  const tContacto = aTexto(useContenido("km-contact-label"));

  useRevelar(raiz, `${galeria.length}-${eventos?.length ?? 0}-${viewport}`);

  const enlaces = [
    galeria.length > 0 && visible("km-work") && { id: "km-work", texto: tTrabajo },
    (eventos?.length ?? 0) > 0 && visible("km-events") && { id: "km-events", texto: tEventos },
    visible("km-about") && { id: "km-about", texto: tSobre },
    visible("km-contact") && { id: "km-contact", texto: tContacto },
  ].filter((x): x is Enlace => Boolean(x));

  return (
    <div
      ref={raiz}
      className="km"
      data-vp={viewport}
      data-editor={readOnly ? undefined : ""}
      onClick={() => selectNode(null)}
    >
      <Nav enlaces={enlaces.filter((l) => l.id !== "km-contact")} alAbrir={menu.abrir} abierto={menu.abierto} />
      <Portada />
      <Cifras />
      <Trabajo alAbrir={(fotos, i) => readOnly && setVisor({ fotos, i })} />
      <Eventos />
      <SobreMi />
      <Contacto />
      <Pie />
      {/* También en el editor: el dueño tiene que poder ver el menú abierto. */}
      <Menu menu={menu} enlaces={enlaces} />
      {visor && <Visor fotos={visor.fotos} inicio={visor.i} alCerrar={() => setVisor(null)} />}
    </div>
  );
}
