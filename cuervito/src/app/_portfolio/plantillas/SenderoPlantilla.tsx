"use client";

/**
 * Sendero — crónica de montaña: hueso, roca y verde verdín, Fraunces e Inter
 * Tight, fotos en arcos y tarjetas redondeadas.
 *
 * Diseñada en Paper (archivo «encontrate — Portfolio», página 6). Todo se
 * mueve con peso y sin apuro, con una sola curva (--sd-curva): el arco de la
 * portada se abre desde un círculo, el sello entra girando, las crónicas se
 * abren en abanico, la foto de la cita y las del «sobre mí» van con
 * parallax, y la fila del cuaderno de ruta se llena de verdín. El menú es una
 * hoja que baja desde arriba.
 *
 * Lo responsive sale de `viewport` (data-vp), no de media queries, igual que
 * en las otras plantillas.
 */

import "./sendero.css";

import { useEffect, useMemo, useRef, useState } from "react";

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

const ROMANOS = ["I", "II", "III", "IV", "V"];
const MAX_EVENTOS = 10;
const imagenLlena = { width: "100%", height: "100%", objectFit: "cover", display: "block" } as const;

const Flecha = ({ diagonal = false }: { diagonal?: boolean }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
    <path d={diagonal ? "M7 17L17 7M9 7h8v8" : "M5 12h14M13 6l6 6-6 6"} />
  </svg>
);

const Montana = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
    <path d="M3 19l6-9 4 6 3-4 5 7z" />
  </svg>
);

/**
 * Parallax de una capa dentro de su caja: la capa se corre `factor` veces lo
 * que se movió la caja respecto del centro de la pantalla. Sólo en el sitio y
 * sin «reducir movimiento»; se escribe directo en el estilo, sin renders.
 */
function useParalaje(ref: React.RefObject<HTMLElement | null>, factor: number) {
  const readOnly = useEditorStore((s) => s.readOnly);
  const reducido = useMovimientoReducido();
  useEffect(() => {
    const el = ref.current;
    const caja = el?.parentElement;
    if (!el || !caja || !readOnly || reducido) return;
    let cuadro = 0;
    const mover = () => {
      cuadro = 0;
      const r = caja.getBoundingClientRect();
      if (r.bottom < -200 || r.top > window.innerHeight + 200) return;
      const desvio = r.top + r.height / 2 - window.innerHeight / 2;
      el.style.translate = `0 ${(desvio * factor).toFixed(1)}px`;
    };
    const pedir = () => {
      cuadro ||= requestAnimationFrame(mover);
    };
    mover();
    window.addEventListener("scroll", pedir, { passive: true });
    window.addEventListener("resize", pedir);
    return () => {
      window.removeEventListener("scroll", pedir);
      window.removeEventListener("resize", pedir);
      cancelAnimationFrame(cuadro);
      el.style.translate = "";
    };
  }, [ref, factor, readOnly, reducido]);
}

/* ── Marca ──────────────────────────────────────────────────────────────── */

function Marca({ nodeId }: { nodeId: string }) {
  const logo = useEditorStore((s) => s.logo);
  if (logo.mode === "image" && logo.imageUrl) {
    return <LogoImage src={logo.imageUrl} alt={logo.text} width={logo.width} crop={logo.imageCrop} />;
  }
  return (
    <span className="sd-marca">
      {logo.mode === "image+text" && logo.imageUrl ? (
        <LogoImage src={logo.imageUrl} width={logo.width} crop={logo.imageCrop} />
      ) : (
        <span className="sd-marca-sello">
          <Montana />
        </span>
      )}
      <EditableNode id={nodeId} tag="span" className="sd-marca-nombre">
        <EditableText id={nodeId} display="inline" />
      </EditableNode>
    </span>
  );
}

/* ── Nav y menú ─────────────────────────────────────────────────────────── */

type Enlace = { id: string; texto: string; numero: string };

function Nav({ enlaces, alAbrir, abierto }: { enlaces: Enlace[]; alAbrir: () => void; abierto: boolean }) {
  const readOnly = useEditorStore((s) => s.readOnly);
  const [solida, setSolida] = useState(false);

  useEffect(() => {
    if (!readOnly) return;
    const mirar = () => setSolida(window.scrollY > 40);
    mirar();
    window.addEventListener("scroll", mirar, { passive: true });
    return () => window.removeEventListener("scroll", mirar);
  }, [readOnly]);

  return (
    <nav id="section-nav" className="sd-nav" data-solida={solida ? "" : undefined}>
      <Marca nodeId="sd-nav-brand" />
      <div className="sd-nav-der">
        {enlaces.slice(0, 2).map((l) => (
          <Clic key={l.id} className="sd-nav-link" alActivar={() => irA(l.id)}>
            {l.texto}
          </Clic>
        ))}
        <Clic className="sd-menu-btn" alActivar={alAbrir} etiqueta="Abrir el menú" expandido={abierto}>
          <span className="sd-menu-btn-txt">Menú</span>
          <span className="sd-barras" aria-hidden>
            <i />
            <i />
          </span>
        </Clic>
      </div>
    </nav>
  );
}

function Menu({ menu, enlaces, fotos }: { menu: ReturnType<typeof useMenu>; enlaces: Enlace[]; fotos: string[] }) {
  const links = useEnlaces();
  return (
    <div
      ref={menu.panel}
      className="sd-menu"
      data-abierto={menu.abierto ? "" : undefined}
      inert={!menu.abierto}
      role="dialog"
      aria-modal="true"
      aria-label="Menú"
      onClick={(e) => {
        if (e.target === e.currentTarget) menu.cerrar();
      }}
    >
      <div className="sd-menu-hoja">
        <div className="sd-menu-nav">
          <Marca nodeId="sd-nav-brand" />
          <button type="button" className="sd-menu-cerrar" onClick={menu.cerrar} aria-label="Cerrar el menú">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <nav className="sd-menu-links">
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
              <span className="sd-menu-t">{l.texto}</span>
              <span className="sd-menu-n">{l.numero}</span>
            </a>
          ))}
        </nav>
        {fotos.length > 0 && (
          <div className="sd-menu-fotos" aria-hidden>
            {fotos.slice(0, 3).map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={src} src={src} alt="" loading="lazy" style={{ "--i": i } as React.CSSProperties} />
            ))}
          </div>
        )}
      </div>
      {(links.instagram ?? links.whatsapp ?? links.tienda) && (
        <div className="sd-menu-pie">
          <span className="sd-menu-pie-r">Escribime</span>
          <div>
            {links.instagram && <a href={links.instagram} target="_blank" rel="noopener noreferrer">Instagram ↗</a>}
            {links.whatsapp && <a href={links.whatsapp} target="_blank" rel="noopener noreferrer">WhatsApp ↗</a>}
            {links.tienda && <a href={links.tienda}>Galerías ↗</a>}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Portada ────────────────────────────────────────────────────────────── */

function Portada() {
  const conSello = useNodoVisible("sd-sello-value");
  return (
    <section id="sd-hero" className="sd-hero">
      <div className="sd-hero-texto">
        <div className="sd-hero-chips">
          <EditableNode id="sd-hero-chip" tag="span" className="sd-chip">
            <EditableText id="sd-hero-chip" display="inline" />
          </EditableNode>
          <EditableNode id="sd-hero-meta" tag="span" className="sd-hero-meta">
            <EditableText id="sd-hero-meta" display="inline" />
          </EditableNode>
        </div>
        <EditableNode id="sd-hero-title" tag="h1" className="sd-hero-titulo">
          <Lineas id="sd-hero-title" className="sd-linea" />
        </EditableNode>
        <div className="sd-hero-pie">
          <EditableNode id="sd-hero-sub" tag="p" className="sd-hero-sub">
            <EditableText id="sd-hero-sub" />
          </EditableNode>
          <Clic className="sd-pill sd-pill-verde" alActivar={() => irA("sd-cronicas")}>
            <EditableNode id="sd-hero-cta" tag="span">
              <EditableText id="sd-hero-cta" display="inline" />
            </EditableNode>
          </Clic>
        </div>
      </div>
      <div className="sd-hero-arco">
        <EditableNode id="sd-hero-image" className="sd-arco" style={{ position: "absolute", inset: 0 }}>
          <EditableImage id="sd-hero-image" imgStyle={imagenLlena} />
        </EditableNode>
        {conSello && (
          <div className="sd-sello">
            <EditableNode id="sd-sello-value" tag="span" className="sd-sello-n">
              <EditableText id="sd-sello-value" display="inline" />
            </EditableNode>
            <EditableNode id="sd-sello-label" tag="span" className="sd-sello-r">
              <EditableText id="sd-sello-label" display="inline" />
            </EditableNode>
          </div>
        )}
      </div>
    </section>
  );
}

/* ── Crónicas ───────────────────────────────────────────────────────────── */

type Cronica = { titulo: string; meta: string; fotos: FotoVisor[] };

/**
 * Tres crónicas: los tres primeros eventos del portfolio. Con menos de tres,
 * las fotos se parten en hasta tres tandas, en orden, para que el abanico no
 * quede con una tarjeta sola.
 */
function useCronicas(): { cronicas: Cronica[]; todas: FotoVisor[]; hayMas: boolean } {
  const proyectos = useProyectos();
  return useMemo(() => {
    const todas = proyectos.flatMap((p) => p.photos.map((f) => ({ src: f.src, titulo: p.title })));
    if (proyectos.length >= 3) {
      return {
        cronicas: proyectos.slice(0, 3).map((p) => ({
          titulo: p.title,
          meta: `${miles(p.photos.length)} fotos`,
          fotos: p.photos.map((f) => ({ src: f.src, titulo: p.title })),
        })),
        todas,
        hayMas: proyectos.length > 3,
      };
    }
    const n = Math.min(3, todas.length);
    const tam = Math.ceil(todas.length / Math.max(n, 1));
    const partes: Record<string, number> = {};
    const cronicas: Cronica[] = [];
    for (let i = 0; i < n; i++) {
      const fotos = todas.slice(i * tam, (i + 1) * tam);
      if (fotos.length === 0) continue;
      const titulo = fotos[0]!.titulo ?? "";
      partes[titulo] = (partes[titulo] ?? 0) + 1;
      cronicas.push({ titulo, meta: `Parte ${partes[titulo]} · ${miles(fotos.length)} fotos`, fotos });
    }
    // Una sola tanda por evento: la «parte 1» sobra.
    for (const c of cronicas) if (partes[c.titulo] === 1) c.meta = c.meta.replace(/^Parte 1 · /, "");
    return { cronicas, todas, hayMas: false };
  }, [proyectos]);
}

function Cronicas({ alAbrir }: { alAbrir: (fotos: FotoVisor[], i: number) => void }) {
  const { cronicas, todas, hayMas } = useCronicas();
  // Con menos de tres, la del medio queda vacía: van a los costados.
  const posiciones = cronicas.length === 1 ? [1] : cronicas.length === 2 ? [0, 2] : [0, 1, 2];
  return (
    <section id="sd-cronicas" className="sd-cronicas">
      <div className="sd-seccion-cab">
        <div className="sd-cab-izq">
          <span className="sd-rotulo">
            I —&nbsp;
            <EditableNode id="sd-cron-label" tag="span">
              <EditableText id="sd-cron-label" display="inline" />
            </EditableNode>
          </span>
          <EditableNode id="sd-cron-heading" tag="h2" className="sd-h2">
            <EditableText id="sd-cron-heading" />
          </EditableNode>
        </div>
        <EditableNode id="sd-cron-intro" tag="p" className="sd-cab-p">
          <EditableText id="sd-cron-intro" />
        </EditableNode>
      </div>

      {cronicas.length === 0 ? (
        <p className="sd-vacio">Las fotos que elijas para el portfolio aparecen acá, agrupadas por evento.</p>
      ) : (
        <div className="sd-abanico" data-rv="" data-n={cronicas.length}>
          {cronicas.map((c, i) => (
            <Clic
              key={`${c.titulo}-${i}`}
              className="sd-tarjeta"
              data-pos={posiciones[i]}
              style={{ "--i": i } as React.CSSProperties}
              etiqueta={`Ver la crónica ${c.titulo}`}
              alActivar={() => alAbrir(c.fotos, 0)}
            >
              <span className="sd-tarjeta-foto">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.fotos[0]!.src} alt="" loading="lazy" />
                <span className="sd-tarjeta-flecha" aria-hidden>
                  <Flecha diagonal />
                </span>
              </span>
              <span className="sd-tarjeta-txt">
                <span className="sd-tarjeta-t">{c.titulo}</span>
                <span className="sd-tarjeta-m">{c.meta}</span>
              </span>
            </Clic>
          ))}
        </div>
      )}

      {hayMas && (
        <div className="sd-mas">
          <Clic className="sd-pill sd-pill-borde" alActivar={() => alAbrir(todas, 0)}>
            Ver todas las fotos ({miles(todas.length)})
          </Clic>
        </div>
      )}
    </section>
  );
}

/* ── Cita ───────────────────────────────────────────────────────────────── */

function Cita() {
  const capa = useRef<HTMLDivElement>(null);
  useParalaje(capa, -0.2);
  return (
    <section id="sd-cita" className="sd-cita">
      <div className="sd-cita-marco">
        <div ref={capa} className="sd-cita-foto">
          <EditableNode id="sd-cita-image" style={{ position: "absolute", inset: 0 }}>
            <EditableImage id="sd-cita-image" imgStyle={imagenLlena} />
          </EditableNode>
        </div>
        <div className="sd-cita-velo" aria-hidden />
        <div className="sd-cita-pie" data-rv="">
          <EditableNode id="sd-cita-text" tag="blockquote" className="sd-cita-texto">
            <EditableText id="sd-cita-text" />
          </EditableNode>
          <EditableNode id="sd-cita-caption" tag="span" className="sd-cita-dato">
            <EditableText id="sd-cita-caption" display="inline" />
          </EditableNode>
        </div>
      </div>
    </section>
  );
}

/* ── Cuaderno de ruta ───────────────────────────────────────────────────── */

function Ruta() {
  const eventos = useEditorStore((s) => s.perfil.eventos) ?? [];
  const readOnly = useEditorStore((s) => s.readOnly);
  const { tienda } = useEnlaces();
  if (eventos.length === 0 && readOnly) return null;
  const lista = eventos.slice(0, MAX_EVENTOS);

  return (
    <section id="sd-ruta" className="sd-ruta">
      <div className="sd-ruta-cab">
        <span className="sd-rotulo">
          II —&nbsp;
          <EditableNode id="sd-ruta-label" tag="span">
            <EditableText id="sd-ruta-label" display="inline" />
          </EditableNode>
        </span>
        <EditableNode id="sd-ruta-heading" tag="h2" className="sd-h2 sd-ruta-h">
          <EditableText id="sd-ruta-heading" />
        </EditableNode>
        <EditableNode id="sd-ruta-intro" tag="p" className="sd-cab-p">
          <EditableText id="sd-ruta-intro" />
        </EditableNode>
      </div>
      <div className="sd-ruta-lista">
        {lista.length === 0 ? (
          <p className="sd-vacio">Cuando publiques eventos, aparecen acá con el link a su galería.</p>
        ) : (
          lista.map((e, i) => {
            const f = partesFecha(e.fecha);
            return (
              <Clic key={e.href} href={e.href} className="sd-fila" data-rv="" style={{ "--i": i } as React.CSSProperties}>
                <span className="sd-fila-fecha">
                  <b>{f?.dia ?? "—"}</b>
                  <small>{f ? `${f.mes} ${f.anio}` : "sin fecha"}</small>
                </span>
                {e.portada && (
                  <span className="sd-fila-mini" aria-hidden>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={e.portada} alt="" loading="lazy" />
                  </span>
                )}
                <span className="sd-fila-cuerpo">
                  <span className="sd-fila-nombre">{e.nombre}</span>
                  {(e.disciplina ?? e.lugar) && (
                    <span className="sd-fila-chips">
                      {e.disciplina && <span className="sd-chip sd-chip-chico">{e.disciplina}</span>}
                      {e.lugar && <span className="sd-chip sd-chip-chico sd-chip-borde">{e.lugar}</span>}
                    </span>
                  )}
                </span>
                <span className="sd-fila-fotos">{miles(e.fotos)} fotos</span>
                <span className="sd-fila-flecha">
                  <Flecha />
                </span>
              </Clic>
            );
          })
        )}
        {eventos.length > lista.length && tienda && (
          <div className="sd-mas sd-mas-izq">
            <Clic className="sd-pill sd-pill-borde" href={tienda}>
              Ver los {eventos.length} eventos en encontrate ↗
            </Clic>
          </div>
        )}
      </div>
    </section>
  );
}

/* ── Sobre mí ───────────────────────────────────────────────────────────── */

function SobreMi() {
  const { instagram, tienda, web } = useEnlaces();
  const grande = useRef<HTMLDivElement>(null);
  const chica = useRef<HTMLDivElement>(null);
  useParalaje(grande, -0.05);
  useParalaje(chica, 0.12);
  return (
    <section id="sd-about" className="sd-sobre">
      <div className="sd-sobre-fotos" data-rv="">
        <div ref={grande} className="sd-sobre-grande">
          <EditableNode id="sd-about-image" style={{ position: "absolute", inset: 0 }}>
            <EditableImage id="sd-about-image" imgStyle={imagenLlena} />
          </EditableNode>
        </div>
        <div ref={chica} className="sd-sobre-chica">
          <EditableNode id="sd-about-image-2" style={{ position: "absolute", inset: 0 }}>
            <EditableImage id="sd-about-image-2" imgStyle={imagenLlena} />
          </EditableNode>
        </div>
      </div>
      <div className="sd-sobre-texto">
        <span className="sd-rotulo">
          III —&nbsp;
          <EditableNode id="sd-about-label" tag="span">
            <EditableText id="sd-about-label" display="inline" />
          </EditableNode>
        </span>
        <EditableNode id="sd-about-heading" tag="h2" className="sd-sobre-h">
          <EditableText id="sd-about-heading" />
        </EditableNode>
        <EditableNode id="sd-about-body" tag="p" className="sd-sobre-p">
          <EditableText id="sd-about-body" />
        </EditableNode>
        {(instagram ?? tienda ?? web) && (
          <div className="sd-sobre-links">
            {instagram && <Clic className="sd-pill sd-pill-oscura" href={instagram} externo>Instagram ↗</Clic>}
            {tienda && <Clic className="sd-pill sd-pill-borde" href={tienda}>Galerías en encontrate ↗</Clic>}
            {web && <Clic className="sd-pill sd-pill-borde" href={web} externo>Web ↗</Clic>}
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
    <section id="sd-contact" className="sd-contacto">
      <div className="sd-contacto-caja">
        <div className="sd-contacto-texto">
          <span className="sd-rotulo sd-rotulo-claro">
            IV —&nbsp;
            <EditableNode id="sd-contact-label" tag="span">
              <EditableText id="sd-contact-label" display="inline" />
            </EditableNode>
          </span>
          <EditableNode id="sd-contact-heading" tag="h2" className="sd-contacto-h">
            <EditableText id="sd-contact-heading" />
          </EditableNode>
          <EditableNode id="sd-contact-body" tag="p" className="sd-contacto-p">
            <EditableText id="sd-contact-body" />
          </EditableNode>
        </div>
        {estado === "enviado" ? (
          <div className="sd-enviado" role="status">
            <span className="sd-enviado-ok" aria-hidden>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M20 6L9 17l-5-5" /></svg>
            </span>
            <span>{porWhatsapp ? "Abriendo WhatsApp…" : "Listo, te respondo en el día."}</span>
          </div>
        ) : (
          <form className="sd-form" onSubmit={alEnviar}>
            <label className="sd-campo">
              <span>Nombre</span>
              <input name="name" required placeholder="Tu nombre o el de la organización" autoComplete="name" disabled={!readOnly} />
            </label>
            <label className="sd-campo">
              <span>Email</span>
              <input name="email" type="email" required placeholder="tu@mail.com" autoComplete="email" disabled={!readOnly} />
            </label>
            <label className="sd-campo sd-campo-alto">
              <span>La carrera</span>
              <textarea name="message" required rows={3} placeholder="Fecha, lugar, distancia…" disabled={!readOnly} />
            </label>
            {estado === "error" && <p className="sd-form-error">No se pudo mandar. Probá de nuevo.</p>}
            <button type="submit" className="sd-pill sd-pill-verde sd-enviar" disabled={estado === "mandando" || !readOnly}>
              {estado === "mandando" ? "Mandando…" : porWhatsapp ? "Mandar por WhatsApp →" : "Mandar consulta →"}
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
    <footer id="section-footer" className="sd-pie">
      <EditableNode id="sd-footer-brand" tag="span" className="sd-pie-marca">
        <EditableText id="sd-footer-brand" display="inline" />
      </EditableNode>
      <div className="sd-pie-links">
        {instagram && <Clic href={instagram} externo>Instagram</Clic>}
        {whatsapp && <Clic href={whatsapp} externo>WhatsApp</Clic>}
        <Clic alActivar={() => irA("sd-hero")}>Volver arriba ↑</Clic>
      </div>
      <span className="sd-pie-copy">
        <EditableNode id="sd-footer-copy" tag="span">
          <EditableText id="sd-footer-copy" display="inline" />
        </EditableNode>
        <span> · Hecho con encontrate</span>
      </span>
    </footer>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */

export function SenderoPlantilla({ viewport }: { viewport: Viewport }) {
  const selectNode = useEditorStore((s) => s.selectNode);
  const readOnly = useEditorStore((s) => s.readOnly);
  const galeria = useEditorStore((s) => s.galleryPhotos);
  const eventos = useEditorStore((s) => s.perfil.eventos);
  const visible = useSeccionVisible();
  const menu = useMenu();
  const raiz = useRef<HTMLDivElement>(null);
  const [visor, setVisor] = useState<{ fotos: FotoVisor[]; i: number } | null>(null);

  const tCronicas = aTexto(useContenido("sd-cron-label"));
  const tRuta = aTexto(useContenido("sd-ruta-label"));
  const tSobre = aTexto(useContenido("sd-about-label"));
  const tContacto = aTexto(useContenido("sd-contact-label"));

  useRevelar(raiz, `${galeria.length}-${eventos?.length ?? 0}-${viewport}`);

  const enlaces = [
    galeria.length > 0 && visible("sd-cronicas") && { id: "sd-cronicas", texto: tCronicas, numero: ROMANOS[0]! },
    (eventos?.length ?? 0) > 0 && visible("sd-ruta") && { id: "sd-ruta", texto: tRuta, numero: ROMANOS[1]! },
    visible("sd-about") && { id: "sd-about", texto: tSobre, numero: ROMANOS[2]! },
    visible("sd-contact") && { id: "sd-contact", texto: tContacto, numero: ROMANOS[3]! },
  ].filter((x): x is Enlace => Boolean(x));

  return (
    <div
      ref={raiz}
      className="sd"
      data-vp={viewport}
      data-editor={readOnly ? undefined : ""}
      onClick={() => selectNode(null)}
    >
      <Nav enlaces={enlaces} alAbrir={menu.abrir} abierto={menu.abierto} />
      <Portada />
      <Cronicas alAbrir={(fotos, i) => readOnly && setVisor({ fotos, i })} />
      <Cita />
      <Ruta />
      <SobreMi />
      <Contacto />
      <Pie />
      {readOnly && <Menu menu={menu} enlaces={enlaces} fotos={galeria.map((f) => f.src)} />}
      {visor && <Visor fotos={visor.fotos} inicio={visor.i} alCerrar={() => setVisor(null)} />}
    </div>
  );
}
