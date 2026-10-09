"use client";

/**
 * Podio — cartelería de estadio: negro, amarillo señal y Anton enorme.
 *
 * Diseñada en Paper (archivo «encontrate — Portfolio», página 4). Todo se
 * mueve seco y rápido, con una sola curva (--pd-curva): el titular sube línea
 * por línea, la cinta de disciplinas se acelera con el scroll, las cifras
 * ruedan como un marcador, las fotos se destapan con una franja amarilla y la
 * fila del evento se pinta al pasar. El menú es una cortina amarilla.
 *
 * Lo responsive sale de `viewport` (data-vp), no de media queries, igual que
 * en las otras plantillas: el editor la muestra en celular sin achicar la
 * ventana.
 */

import "./podio.css";

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
  useAjustarAncho,
  useContacto,
  useContenido,
  useEnlaces,
  useMenu,
  useMovimientoReducido,
  useNodoVisible,
  usePunteroFino,
  useProyectos,
  useRevelar,
  useSeccionVisible,
  Visor,
  type FotoVisor,
} from "./comun";

const PASO = 10;
const DIGITOS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

const Flecha = ({ diagonal = false }: { diagonal?: boolean }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
    <path d={diagonal ? "M7 17L17 7M9 7h8v8" : "M5 12h14M13 6l6 6-6 6"} />
  </svg>
);

/* ── Marca ──────────────────────────────────────────────────────────────── */

function Marca({ nodeId }: { nodeId: string }) {
  const logo = useEditorStore((s) => s.logo);
  const nombre = aTexto(useContenido(nodeId));
  const iniciales = nombre
    .split(/\s+/)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .filter(Boolean)
    .slice(0, 2)
    .join("");

  if (logo.mode === "image" && logo.imageUrl) {
    return <LogoImage src={logo.imageUrl} alt={logo.text} width={logo.width} crop={logo.imageCrop} />;
  }
  return (
    <span className="pd-marca">
      {logo.mode === "image+text" && logo.imageUrl ? (
        <LogoImage src={logo.imageUrl} width={logo.width} crop={logo.imageCrop} />
      ) : (
        <span className="pd-marca-sello" aria-hidden>{iniciales}</span>
      )}
      <EditableNode id={nodeId} tag="span" className="pd-marca-nombre">
        <EditableText id={nodeId} display="inline" />
      </EditableNode>
    </span>
  );
}

/* ── Nav y menú ─────────────────────────────────────────────────────────── */

type Enlace = { id: string; texto: string; extra?: string };

function Nav({ alAbrir, abierto }: { alAbrir: () => void; abierto: boolean }) {
  const readOnly = useEditorStore((s) => s.readOnly);
  const [solida, setSolida] = useState(false);

  // Sobre la portada va transparente; después, una barra negra.
  useEffect(() => {
    if (!readOnly) return;
    const mirar = () => setSolida(window.scrollY > window.innerHeight * 0.6);
    mirar();
    window.addEventListener("scroll", mirar, { passive: true });
    return () => window.removeEventListener("scroll", mirar);
  }, [readOnly]);

  return (
    <nav id="section-nav" className="pd-nav" data-solida={solida ? "" : undefined}>
      <Marca nodeId="pd-nav-brand" />
      <div className="pd-nav-der">
        <EditableNode id="pd-nav-estado" tag="span" className="pd-nav-estado">
          <EditableText id="pd-nav-estado" display="inline" />
        </EditableNode>
        <Clic className="pd-menu-btn" alActivar={alAbrir} etiqueta="Abrir el menú" expandido={abierto}>
          <span className="pd-menu-btn-txt">Menú</span>
          <span className="pd-barras" aria-hidden>
            <i />
            <i />
            <i />
          </span>
        </Clic>
      </div>
    </nav>
  );
}

function Menu({
  menu,
  enlaces,
  fotos,
}: {
  menu: ReturnType<typeof useMenu>;
  enlaces: Enlace[];
  fotos: string[];
}) {
  const links = useEnlaces();
  return (
    <div
      ref={menu.panel}
      className="pd-menu"
      data-abierto={menu.abierto ? "" : undefined}
      inert={!menu.abierto}
      role="dialog"
      aria-modal="true"
      aria-label="Menú"
    >
      <div className="pd-menu-nav">
        <Marca nodeId="pd-nav-brand" />
        <button type="button" className="pd-menu-cerrar" onClick={menu.cerrar} aria-label="Cerrar el menú">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
            <path d="M5 5l14 14M19 5L5 19" />
          </svg>
        </button>
      </div>
      <nav className="pd-menu-links">
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
            <span className="pd-menu-n">{String(i + 1).padStart(2, "0")}</span>
            <span className="pd-menu-t">{l.texto}</span>
            <span className="pd-menu-x">{l.extra ?? <Flecha />}</span>
          </a>
        ))}
      </nav>
      <div className="pd-menu-pie">
        {fotos.length > 0 && (
          <div className="pd-menu-fotos" aria-hidden>
            {fotos.slice(0, 3).map((src) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={src} src={src} alt="" loading="lazy" />
            ))}
          </div>
        )}
        <div className="pd-menu-redes">
          {links.instagram && <a href={links.instagram} target="_blank" rel="noopener noreferrer">Instagram ↗</a>}
          {links.whatsapp && <a href={links.whatsapp} target="_blank" rel="noopener noreferrer">WhatsApp ↗</a>}
          {links.tienda && <a href={links.tienda}>Galerías ↗</a>}
          <span>● {new Date().getFullYear()}</span>
        </div>
      </div>
    </div>
  );
}

/* ── Portada ────────────────────────────────────────────────────────────── */

function Portada() {
  return (
    <section id="pd-hero" className="pd-hero">
      <EditableNode id="pd-hero-image" className="pd-hero-foto" style={{ position: "absolute" }}>
        <EditableImage id="pd-hero-image" imgStyle={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      </EditableNode>
      <div className="pd-hero-velo" aria-hidden />
      <div className="pd-hero-cuerpo">
        <div className="pd-volanta">
          <i aria-hidden />
          <EditableNode id="pd-hero-eyebrow" tag="span">
            <EditableText id="pd-hero-eyebrow" display="inline" />
          </EditableNode>
        </div>
        <EditableNode id="pd-hero-title" tag="h1" className="pd-hero-titulo">
          <Lineas id="pd-hero-title" className="pd-linea" />
        </EditableNode>
        <div className="pd-hero-pie">
          <EditableNode id="pd-hero-sub" tag="p" className="pd-hero-sub">
            <EditableText id="pd-hero-sub" />
          </EditableNode>
          <div className="pd-hero-datos">
            <EditableNode id="pd-hero-meta" tag="span">
              <EditableText id="pd-hero-meta" display="inline" />
            </EditableNode>
            <Clic className="pd-hero-scroll" alActivar={() => irA("pd-work")}>
              Scroll ↓
            </Clic>
          </div>
          <div className="pd-hero-ctas">
            <Clic className="pd-btn pd-btn-acento" alActivar={() => irA("pd-work")}>
              <EditableNode id="pd-hero-cta-1" tag="span">
                <EditableText id="pd-hero-cta-1" display="inline" />
              </EditableNode>
            </Clic>
            <Clic className="pd-btn" alActivar={() => irA("pd-contact")}>
              <EditableNode id="pd-hero-cta-2" tag="span">
                <EditableText id="pd-hero-cta-2" display="inline" />
              </EditableNode>
            </Clic>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Cinta de disciplinas ───────────────────────────────────────────────── */

function Cinta() {
  const readOnly = useEditorStore((s) => s.readOnly);
  const reducido = useMovimientoReducido();
  const items = aTexto(useContenido("pd-cinta"))
    .split("·")
    .map((x) => x.trim())
    .filter(Boolean);
  const pista = useRef<HTMLDivElement>(null);

  // Al scrollear, la cinta se acelera con la velocidad de la rueda y vuelve
  // sola a su ritmo. Mueve la animación de CSS (playbackRate), no la reemplaza.
  useEffect(() => {
    const anim = pista.current?.getAnimations()[0];
    if (!readOnly || reducido || !anim) return;
    let ritmo = 1;
    let cuadro = 0;
    let ultimo = window.scrollY;
    const paso = () => {
      ritmo += (1 - ritmo) * 0.05;
      anim.playbackRate = ritmo;
      cuadro = Math.abs(ritmo - 1) > 0.01 ? requestAnimationFrame(paso) : 0;
      if (!cuadro) anim.playbackRate = 1;
    };
    const scroll = () => {
      const d = Math.abs(window.scrollY - ultimo);
      ultimo = window.scrollY;
      ritmo = Math.min(Math.max(ritmo, 1 + d / 6), 7);
      cuadro ||= requestAnimationFrame(paso);
    };
    window.addEventListener("scroll", scroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", scroll);
      cancelAnimationFrame(cuadro);
    };
  }, [readOnly, reducido, items.length]);

  if (items.length === 0) return null;
  // Cada mitad repite la lista hasta llenar más de una pantalla: la animación
  // corre la pista media vuelta y empieza de nuevo sin que se note el salto.
  const vueltas = Math.max(2, Math.ceil(10 / items.length));
  const mitad = Array.from({ length: vueltas }, () => items).flat();
  return (
    <section id="pd-cinta" className="pd-cinta" aria-label="Disciplinas">
      <EditableNode id="pd-cinta" className="pd-cinta-marco">
        <span className="pd-oculto">{items.join(", ")}</span>
        <div ref={pista} className="pd-cinta-pista" aria-hidden>
          {[0, 1].map((copia) => (
            <div key={copia} className="pd-cinta-mitad">
              {mitad.map((x, i) => (
                <span key={i}>
                  {x}
                  <i />
                </span>
              ))}
            </div>
          ))}
        </div>
      </EditableNode>
    </section>
  );
}

/* ── Tablero ────────────────────────────────────────────────────────────── */

/** Una cifra que, al entrar, hace rodar cada dígito hasta su número. */
function Rodillo({ id }: { id: string }) {
  const texto = aTexto(useContenido(id));
  return (
    <span className="pd-rodillo" aria-label={texto}>
      {[...texto].map((c, i) =>
        /\d/.test(c) ? (
          <span key={i} className="pd-rueda" aria-hidden style={{ "--d": c, "--i": i } as React.CSSProperties}>
            <span>
              {DIGITOS.map((d) => (
                <span key={d}>{d}</span>
              ))}
            </span>
          </span>
        ) : (
          <span key={i} aria-hidden>
            {c === " " ? " " : c}
          </span>
        ),
      )}
    </span>
  );
}

function Tablero() {
  const v1 = useNodoVisible("pd-stat-1-value");
  const v2 = useNodoVisible("pd-stat-2-value");
  const v3 = useNodoVisible("pd-stat-3-value");
  const cifras = [v1 && 1, v2 && 2, v3 && 3].filter((n): n is number => Boolean(n));
  if (cifras.length === 0) return null;
  return (
    <section id="pd-tablero" className="pd-tablero">
      <div className="pd-rotulo">
        <span>01 /&nbsp;</span>
        <EditableNode id="pd-tablero-label" tag="span">
          <EditableText id="pd-tablero-label" display="inline" />
        </EditableNode>
      </div>
      <div className="pd-cifras" data-rv="">
        {cifras.map((n) => (
          <div key={n} className="pd-cifra">
            <EditableNode id={`pd-stat-${n}-value`} className="pd-cifra-valor">
              <Rodillo id={`pd-stat-${n}-value`} />
            </EditableNode>
            <EditableNode id={`pd-stat-${n}-label`} className="pd-cifra-rotulo">
              <EditableText id={`pd-stat-${n}-label`} />
            </EditableNode>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── Trabajo ────────────────────────────────────────────────────────────── */

type FotoTrabajo = { src: string; grupo: string; n: number };

function Foto({ f, alAbrir, style }: { f: FotoTrabajo; alAbrir: () => void; style?: React.CSSProperties }) {
  return (
    <Clic className="pd-foto" alActivar={alAbrir} etiqueta={`Ver la foto ${f.n} en grande`} style={style} data-rv="">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={f.src} alt={f.grupo} loading="lazy" />
      <span className="pd-foto-tapa" aria-hidden />
      <span className="pd-foto-flecha" aria-hidden>
        <Flecha diagonal />
      </span>
      <span className="pd-foto-pie">
        <b>#{String(f.n).padStart(2, "0")}</b>
        <span>{f.grupo}</span>
      </span>
    </Clic>
  );
}

function Trabajo({ viewport, alAbrir }: { viewport: Viewport; alAbrir: (fotos: FotoVisor[], i: number) => void }) {
  const galeria = useEditorStore((s) => s.galleryPhotos);
  const grid = useEditorStore((s) => s.grid);
  const proyectos = useProyectos();
  const [filtro, setFiltro] = useState<string | null>(null);
  const [cuantas, setCuantas] = useState(PASO);

  const todas = useMemo<FotoTrabajo[]>(
    () => galeria.map((f, i) => ({ src: f.src, grupo: f.group?.trim() ?? "", n: i + 1 })),
    [galeria],
  );
  const filtradas = filtro ? todas.filter((f) => f.grupo === filtro) : todas;
  const visibles = filtradas.slice(0, cuantas);
  const abrir = (i: number) => alAbrir(visibles.map((f) => ({ src: f.src, titulo: f.grupo })), i);

  const cols = viewport === "mobile" ? Math.min(grid.columns, 2) : viewport === "tablet" ? Math.min(grid.columns, 3) : grid.columns;
  const estiloGrilla = { "--pd-gap": `${grid.gap}px`, "--pd-cols": cols } as React.CSSProperties;

  // El mosaico de Podio: una fila con una foto grande y una vertical, otra
  // con tres iguales, y así.
  const filas: FotoTrabajo[][] = [];
  if (grid.layout === "mosaic") {
    for (let i = 0, a = true; i < visibles.length; a = !a) {
      const n = a ? 2 : 3;
      filas.push(visibles.slice(i, i + n));
      i += n;
    }
  }
  let indice = 0;

  return (
    <section id="pd-work" className="pd-trabajo">
      <div className="pd-seccion-cab">
        <div className="pd-titulo-con-n">
          <EditableNode id="pd-work-title" tag="h2" className="pd-titulo">
            <EditableText id="pd-work-title" />
          </EditableNode>
          <span className="pd-cuenta">({filtradas.length})</span>
        </div>
        {proyectos.length > 1 && (
          <div className="pd-filtros" role="group" aria-label="Filtrar por evento">
            {[null, ...proyectos.map((p) => p.title)].map((t) => (
              <Clic
                key={t ?? "todo"}
                className="pd-filtro"
                data-activo={filtro === t ? "" : undefined}
                alActivar={() => {
                  setFiltro(t);
                  setCuantas(PASO);
                }}
              >
                {t ?? "Todo"}
              </Clic>
            ))}
          </div>
        )}
      </div>

      {todas.length === 0 ? (
        <p className="pd-vacio">Las fotos que elijas para el portfolio aparecen acá.</p>
      ) : grid.layout === "mosaic" ? (
        <div key={filtro ?? ""} className="pd-mosaico" style={estiloGrilla}>
          {filas.map((fila, i) => (
            <div key={i} className="pd-fila" data-tipo={i % 2 === 0 ? "a" : "b"} data-n={fila.length}>
              {fila.map((f) => {
                const j = indice++;
                return <Foto key={f.n} f={f} alAbrir={() => abrir(j)} />;
              })}
            </div>
          ))}
        </div>
      ) : grid.layout === "masonry" ? (
        <div key={filtro ?? ""} className="pd-cascada" style={estiloGrilla}>
          {visibles.map((f, i) => (
            <Foto key={f.n} f={f} alAbrir={() => abrir(i)} />
          ))}
        </div>
      ) : (
        <div key={filtro ?? ""} className="pd-grilla" style={estiloGrilla}>
          {visibles.map((f, i) => (
            <Foto key={f.n} f={f} alAbrir={() => abrir(i)} />
          ))}
        </div>
      )}

      {filtradas.length > cuantas && (
        <div className="pd-mas">
          <Clic className="pd-btn" alActivar={() => setCuantas((c) => c + PASO)}>
            Ver más ({filtradas.length - cuantas})
          </Clic>
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
  const fino = usePunteroFino();
  const tabla = useRef<HTMLDivElement>(null);
  const mini = useRef<HTMLImageElement>(null);
  const [sobre, setSobre] = useState<number | null>(null);

  if (eventos.length === 0 && readOnly) return null;
  const lista = eventos.slice(0, 8);
  const portada = sobre === null ? null : lista[sobre]?.portada;

  // La miniatura sigue al cursor sin pasar por React: se mueve en cada
  // pointermove, y un render por movimiento sería tirar cuadros.
  const mover = (e: React.PointerEvent) => {
    const fila = (e.target as Element).closest<HTMLElement>("[data-ev]");
    const i = fila ? Number(fila.dataset.ev) : null;
    if (i !== sobre) setSobre(i);
    const caja = tabla.current?.getBoundingClientRect();
    if (caja && mini.current) mini.current.style.translate = `${e.clientX - caja.left}px ${e.clientY - caja.top}px`;
  };

  return (
    <section id="pd-events" className="pd-eventos">
      <div className="pd-seccion-cab">
        <EditableNode id="pd-events-title" tag="h2" className="pd-titulo">
          <EditableText id="pd-events-title" />
        </EditableNode>
        <EditableNode id="pd-events-intro" tag="p" className="pd-eventos-intro">
          <EditableText id="pd-events-intro" />
        </EditableNode>
      </div>
      {lista.length === 0 ? (
        <p className="pd-vacio">Cuando publiques eventos, aparecen acá con el link a su galería.</p>
      ) : (
        <div ref={tabla} className="pd-tabla" onPointerMove={fino ? mover : undefined} onPointerLeave={() => setSobre(null)}>
          <div className="pd-tabla-cab" aria-hidden>
            <span>N°</span>
            <span>Evento</span>
            <span>Disciplina</span>
            <span>Fecha</span>
            <span>Fotos</span>
            <span />
          </div>
          {lista.map((e, i) => {
            const f = partesFecha(e.fecha);
            return (
              <Clic key={e.href} href={e.href} className="pd-evento" data-ev={i} data-rv="" style={{ "--i": i } as React.CSSProperties}>
                <span className="pd-ev-n">{String(i + 1).padStart(2, "0")}</span>
                <span className="pd-ev-nombre">{e.nombre}</span>
                <span className="pd-ev-dato">{e.disciplina ?? "—"}</span>
                <span className="pd-ev-dato">{f ? `${f.dia} ${f.mes} ${f.anio}` : "—"}</span>
                <span className="pd-ev-dato pd-ev-fotos">{miles(e.fotos)}</span>
                <span className="pd-ev-flecha">
                  <Flecha />
                </span>
              </Clic>
            );
          })}
          {fino && (
            // eslint-disable-next-line @next/next/no-img-element
            <img ref={mini} className="pd-tabla-mini" src={portada ?? undefined} alt="" aria-hidden data-ver={portada ? "" : undefined} />
          )}
        </div>
      )}
      {eventos.length > lista.length && tienda && (
        <div className="pd-mas">
          <Clic className="pd-btn" href={tienda}>
            Ver los {eventos.length} eventos ↗
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
    <section id="pd-about" className="pd-sobre">
      <div className="pd-sobre-retrato" data-rv="">
        <EditableNode id="pd-about-image" style={{ position: "absolute", inset: 0 }}>
          <EditableImage id="pd-about-image" imgStyle={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        </EditableNode>
        <span className="pd-insignia">
          02 /&nbsp;
          <EditableNode id="pd-about-label" tag="span">
            <EditableText id="pd-about-label" display="inline" />
          </EditableNode>
        </span>
      </div>
      <div className="pd-sobre-texto">
        <EditableNode id="pd-about-heading" tag="h2" className="pd-sobre-h" >
          <EditableText id="pd-about-heading" />
        </EditableNode>
        <div className="pd-sobre-cols">
          <EditableNode id="pd-about-body-1" tag="p">
            <EditableText id="pd-about-body-1" />
          </EditableNode>
          <EditableNode id="pd-about-body-2" tag="p">
            <EditableText id="pd-about-body-2" />
          </EditableNode>
        </div>
        {(instagram ?? tienda ?? web) && (
          <div className="pd-sobre-links">
            {instagram && <Clic className="pd-btn pd-btn-claro" href={instagram} externo>Instagram ↗</Clic>}
            {tienda && <Clic className="pd-btn" href={tienda}>Mis galerías ↗</Clic>}
            {web && <Clic className="pd-btn" href={web} externo>Web ↗</Clic>}
          </div>
        )}
      </div>
    </section>
  );
}

/* ── Contacto ───────────────────────────────────────────────────────────── */

function Contacto() {
  const { estado, alEnviar, porWhatsapp, readOnly } = useContacto();
  return (
    <section id="pd-contact" className="pd-contacto">
      <div className="pd-contacto-texto">
        <div className="pd-rotulo pd-rotulo-oscuro">
          <span>03 /&nbsp;</span>
          <EditableNode id="pd-contact-label" tag="span">
            <EditableText id="pd-contact-label" display="inline" />
          </EditableNode>
        </div>
        <EditableNode id="pd-contact-heading" tag="h2" className="pd-contacto-h">
          <EditableText id="pd-contact-heading" />
        </EditableNode>
        <EditableNode id="pd-contact-body" tag="p" className="pd-contacto-p">
          <EditableText id="pd-contact-body" />
        </EditableNode>
      </div>
      {estado === "enviado" ? (
        <div className="pd-enviado" role="status">
          <span>{porWhatsapp ? "Abriendo WhatsApp…" : "Listo. Te respondo en el día."}</span>
        </div>
      ) : (
        <form className="pd-form" onSubmit={alEnviar}>
          <label>
            <span>Nombre</span>
            <input name="name" required placeholder="Tu nombre o el de la organización" autoComplete="name" disabled={!readOnly} />
          </label>
          <label>
            <span>Email</span>
            <input name="email" type="email" required placeholder="tu@mail.com" autoComplete="email" disabled={!readOnly} />
          </label>
          <label>
            <span>La carrera</span>
            <textarea name="message" required rows={2} placeholder="Fecha, lugar, distancia…" disabled={!readOnly} />
          </label>
          {estado === "error" && <p className="pd-form-error">No se pudo mandar. Probá de nuevo.</p>}
          <button type="submit" className="pd-enviar" disabled={estado === "mandando" || !readOnly}>
            <span>{estado === "mandando" ? "Mandando…" : porWhatsapp ? "Mandar por WhatsApp" : "Mandar consulta"}</span>
            <Flecha />
          </button>
        </form>
      )}
    </section>
  );
}

/* ── Pie ────────────────────────────────────────────────────────────────── */

function Pie() {
  const { instagram, whatsapp } = useEnlaces();
  const nombre = useContenido("pd-footer-brand");
  const caja = useRef<HTMLDivElement>(null);
  useAjustarAncho(caja, nombre);
  return (
    <footer id="section-footer" className="pd-pie">
      <div ref={caja} className="pd-pie-nombre">
        <EditableNode id="pd-footer-brand" tag="span">
          <EditableText id="pd-footer-brand" display="inline" />
        </EditableNode>
      </div>
      <div className="pd-pie-fila">
        <EditableNode id="pd-footer-copy" tag="span">
          <EditableText id="pd-footer-copy" display="inline" />
        </EditableNode>
        <div className="pd-pie-links">
          {instagram && <Clic href={instagram} externo>Instagram</Clic>}
          {whatsapp && <Clic href={whatsapp} externo>WhatsApp</Clic>}
          <Clic alActivar={() => irA("pd-hero")}>Arriba ↑</Clic>
        </div>
        <span className="pd-pie-hecho">Hecho con encontrate</span>
      </div>
    </footer>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */

export function PodioPlantilla({ viewport }: { viewport: Viewport }) {
  const selectNode = useEditorStore((s) => s.selectNode);
  const readOnly = useEditorStore((s) => s.readOnly);
  const galeria = useEditorStore((s) => s.galleryPhotos);
  const eventos = useEditorStore((s) => s.perfil.eventos);
  const grid = useEditorStore((s) => s.grid);
  const visible = useSeccionVisible();
  const menu = useMenu();
  const raiz = useRef<HTMLDivElement>(null);
  const [visor, setVisor] = useState<{ fotos: FotoVisor[]; i: number } | null>(null);

  const tTrabajo = aTexto(useContenido("pd-work-title"));
  const tEventos = aTexto(useContenido("pd-events-title"));
  const tSobre = aTexto(useContenido("pd-about-label"));
  const tContacto = aTexto(useContenido("pd-contact-label"));

  useRevelar(raiz, `${galeria.length}-${grid.layout}-${viewport}`);

  const enlaces: Enlace[] = [
    galeria.length > 0 && visible("pd-work") && { id: "pd-work", texto: tTrabajo, extra: `(${galeria.length})` },
    (eventos?.length ?? 0) > 0 && visible("pd-events") && { id: "pd-events", texto: tEventos },
    visible("pd-about") && { id: "pd-about", texto: tSobre },
    visible("pd-contact") && { id: "pd-contact", texto: tContacto },
  ].filter((x): x is Enlace => Boolean(x));

  return (
    <div
      ref={raiz}
      className="pd"
      data-vp={viewport}
      data-editor={readOnly ? undefined : ""}
      onClick={() => selectNode(null)}
    >
      <Nav alAbrir={menu.abrir} abierto={menu.abierto} />
      <Portada />
      <Cinta />
      <Tablero />
      <Trabajo viewport={viewport} alAbrir={(fotos, i) => readOnly && setVisor({ fotos, i })} />
      <Eventos />
      <SobreMi />
      <Contacto />
      <Pie />
      {readOnly && <Menu menu={menu} enlaces={enlaces} fotos={galeria.map((f) => f.src)} />}
      {visor && <Visor fotos={visor.fotos} inicio={visor.i} alCerrar={() => setVisor(null)} />}
    </div>
  );
}
