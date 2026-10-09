"use client";

/**
 * Fotofinish — revista suiza: blanco, cobalto e Instrument Sans ajustada.
 *
 * Diseñada en Paper (archivo «encontrate — Portfolio», página 5). Todo se
 * mueve suave y largo, con una sola curva (--ff-curva): los titulares suben
 * línea por línea, la tira de fotos queda fija mientras el scroll la recorre
 * de lado, las cifras cuentan desde cero, la serie destacada tiene un cursor
 * «Ver» y la fila del índice se pinta de cobalto con una miniatura que sigue
 * al cursor. El menú es un panel cobalto que entra desde la derecha.
 *
 * Lo responsive sale de `viewport` (data-vp), no de media queries, igual que
 * en las otras plantillas.
 */

import "./fotofinish.css";

import { useEffect, useMemo, useRef, useState } from "react";

import { EditableImage, EditableNode, EditableText, LogoImage } from "../primitivas";
import type { Proyecto } from "../proyectos";
import { useEditorStore, type EventoSitio } from "../store";
import type { Viewport } from "../tipos";
import {
  aTexto,
  Clic,
  irA,
  Lineas,
  miles,
  partesFecha,
  partirCifra,
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

const MAX_TIRA = 24;

/* ── Marca ──────────────────────────────────────────────────────────────── */

function Marca() {
  const logo = useEditorStore((s) => s.logo);
  if (logo.mode === "image" && logo.imageUrl) {
    return <LogoImage src={logo.imageUrl} alt={logo.text} width={logo.width} crop={logo.imageCrop} />;
  }
  return (
    <span className="ff-marca">
      {logo.mode === "image+text" && logo.imageUrl && <LogoImage src={logo.imageUrl} width={logo.width} crop={logo.imageCrop} />}
      <EditableNode id="ff-nav-brand" tag="span" className="ff-marca-nombre">
        <EditableText id="ff-nav-brand" display="inline" />
      </EditableNode>
    </span>
  );
}

/** El rótulo de sección: la letra fija y el texto editable. */
function Riel({ letra, id, children }: { letra: string; id: string; children?: React.ReactNode }) {
  return (
    <div className="ff-riel">
      <span className="ff-letra">({letra})</span>
      <EditableNode id={id} tag="span" className="ff-riel-t">
        <EditableText id={id} display="inline" />
      </EditableNode>
      {children}
    </div>
  );
}

/* ── Nav y menú ─────────────────────────────────────────────────────────── */

type Enlace = { id: string; texto: string };

function Nav({ alAbrir, abierto }: { alAbrir: () => void; abierto: boolean }) {
  return (
    <nav id="section-nav" className="ff-nav">
      <div className="ff-nav-marca">
        <Marca />
      </div>
      <EditableNode id="ff-nav-sub" tag="span" className="ff-nav-sub">
        <EditableText id="ff-nav-sub" display="inline" />
      </EditableNode>
      <div className="ff-nav-der">
        <EditableNode id="ff-nav-estado" tag="span" className="ff-nav-estado">
          <EditableText id="ff-nav-estado" display="inline" />
        </EditableNode>
        <Clic className="ff-pildora ff-menu-btn" alActivar={alAbrir} etiqueta="Abrir el menú" expandido={abierto}>
          <span>Menú</span>
          <span className="ff-circulo" aria-hidden>
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
  serie,
}: {
  menu: ReturnType<typeof useMenu>;
  enlaces: Enlace[];
  serie: Proyecto | null;
}) {
  const links = useEnlaces();
  const [activa, setActiva] = useState<string | null>(null);

  // El subrayado marca la sección que está en pantalla.
  const ids = enlaces.map((e) => e.id).join(",");
  useEffect(() => {
    const io = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) if (e.isIntersecting) setActiva(e.target.id);
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    for (const id of ids.split(",")) {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    }
    return () => io.disconnect();
  }, [ids]);

  return (
    <div className="ff-menu-capa" data-abierto={menu.abierto ? "" : undefined}>
      <div className="ff-menu-velo" onClick={menu.cerrar} aria-hidden />
      <div ref={menu.panel} className="ff-menu" inert={!menu.abierto} role="dialog" aria-modal="true" aria-label="Menú">
        <div className="ff-menu-cab">
          <span>Índice</span>
          <button type="button" className="ff-pildora ff-menu-cerrar" onClick={menu.cerrar}>
            <span>Cerrar</span>
            <span className="ff-circulo" aria-hidden>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M5 5l14 14M19 5L5 19" />
              </svg>
            </span>
          </button>
        </div>
        <nav className="ff-menu-links">
          {enlaces.map((l, i) => (
            <a
              key={l.id}
              href={`#${l.id}`}
              data-activa={activa === l.id ? "" : undefined}
              style={{ "--i": i } as React.CSSProperties}
              onClick={(e) => {
                e.preventDefault();
                menu.ir(l.id);
              }}
            >
              <span className="ff-menu-letra">{String.fromCharCode(65 + i)}</span>
              <span className="ff-menu-t">{l.texto}</span>
            </a>
          ))}
        </nav>
        <div className="ff-menu-pie">
          {serie?.photos[0] && (
            <a
              href="#ff-serie"
              className="ff-menu-serie"
              onClick={(e) => {
                e.preventDefault();
                menu.ir("ff-serie");
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={serie.photos[0].src} alt="" loading="lazy" />
              <span>
                <small>Última serie</small>
                <b>{serie.title} →</b>
              </span>
            </a>
          )}
          {(links.instagram ?? links.whatsapp ?? links.tienda) && (
            <div className="ff-menu-redes">
              {links.instagram && <a href={links.instagram} target="_blank" rel="noopener noreferrer">Instagram ↗</a>}
              {links.whatsapp && <a href={links.whatsapp} target="_blank" rel="noopener noreferrer">WhatsApp ↗</a>}
              {links.tienda && <a href={links.tienda}>Galerías ↗</a>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Portada ────────────────────────────────────────────────────────────── */

function Portada() {
  return (
    <section id="ff-hero" className="ff-hero">
      <EditableNode id="ff-hero-title" tag="h1" className="ff-hero-titulo">
        <Lineas id="ff-hero-title" className="ff-linea" />
      </EditableNode>
      <div className="ff-hero-lado">
        <i className="ff-punto" aria-hidden />
        <EditableNode id="ff-hero-sub" tag="p" className="ff-hero-sub">
          <EditableText id="ff-hero-sub" />
        </EditableNode>
        <EditableNode id="ff-hero-meta" tag="span" className="ff-hero-meta">
          <EditableText id="ff-hero-meta" display="inline" />
        </EditableNode>
      </div>
    </section>
  );
}

/* ── Tira ───────────────────────────────────────────────────────────────── */

function Tira({ viewport, alAbrir }: { viewport: Viewport; alAbrir: (fotos: FotoVisor[], i: number) => void }) {
  const galeria = useEditorStore((s) => s.galleryPhotos);
  const readOnly = useEditorStore((s) => s.readOnly);
  const reducido = useMovimientoReducido();
  const fotos = galeria.slice(0, MAX_TIRA);
  const total = fotos.length;
  // Fija (el scroll vertical la recorre de lado) sólo en el sitio, en
  // pantallas anchas y sin «reducir movimiento». Si no, se desliza con el dedo.
  const fija = readOnly && !reducido && viewport !== "mobile";

  const seccion = useRef<HTMLElement>(null);
  const ventana = useRef<HTMLDivElement>(null);
  const pista = useRef<HTMLDivElement>(null);
  const barra = useRef<HTMLSpanElement>(null);
  const cuenta = useRef<HTMLSpanElement>(null);
  const [recorrido, setRecorrido] = useState(0);

  // Cuánto hay que correr la pista para llegar a la última foto.
  useEffect(() => {
    const v = ventana.current;
    const p = pista.current;
    if (!v || !p) return;
    const medir = () => setRecorrido(Math.max(0, p.scrollWidth - v.clientWidth));
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(v);
    ro.observe(p);
    return () => ro.disconnect();
  }, [total]);

  // El progreso: la barra cobalto y el contador. Se escriben directo en el
  // DOM; un render por cuadro de scroll sería tirar cuadros.
  useEffect(() => {
    const s = seccion.current;
    const v = ventana.current;
    const p = pista.current;
    if (!s || !v || !p || total === 0) return;
    let cuadro = 0;
    const pintar = (avance: number) => {
      if (barra.current) barra.current.style.transform = `scaleX(${Math.max(avance, 1 / total)})`;
      if (cuenta.current) cuenta.current.textContent = String(Math.round(avance * (total - 1)) + 1).padStart(2, "0");
    };
    if (fija) {
      const mover = () => {
        cuadro = 0;
        const r = s.getBoundingClientRect();
        const largo = r.height - window.innerHeight;
        const avance = largo > 0 ? Math.min(Math.max(-r.top / largo, 0), 1) : 0;
        p.style.transform = `translate3d(${-avance * recorrido}px, 0, 0)`;
        pintar(avance);
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
      };
    }
    p.style.transform = "";
    const deslizar = () => {
      const largo = v.scrollWidth - v.clientWidth;
      pintar(largo > 0 ? v.scrollLeft / largo : 0);
    };
    deslizar();
    v.addEventListener("scroll", deslizar, { passive: true });
    return () => v.removeEventListener("scroll", deslizar);
  }, [fija, recorrido, total]);

  if (total === 0 && readOnly) return null;
  const visor = fotos.map((f) => ({ src: f.src, titulo: f.group }));

  return (
    <section
      id="ff-work"
      ref={seccion}
      className="ff-tira"
      data-modo={fija ? "fija" : "libre"}
      style={fija ? { height: `calc(100svh + ${recorrido}px)` } : undefined}
    >
      <div className="ff-tira-pegada">
        {total === 0 ? (
          <p className="ff-vacio">Las fotos que elijas para el portfolio aparecen acá.</p>
        ) : (
          <div ref={ventana} className="ff-tira-ventana">
            <div ref={pista} className="ff-tira-pista">
              {fotos.map((f, i) => {
                const fecha = partesFecha(f.date);
                return (
                  <Clic
                    key={`${f.src}-${i}`}
                    className="ff-foto"
                    data-ancho={i % 3 === 1 ? "angosta" : "ancha"}
                    data-rv=""
                    alActivar={() => alAbrir(visor, i)}
                    etiqueta={`Ver la foto ${i + 1} en grande`}
                  >
                    <span className="ff-foto-caja">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={f.src} alt={f.group ?? ""} loading={i < 3 ? "eager" : "lazy"} />
                    </span>
                    <span className="ff-foto-pie">
                      <b>{String(i + 1).padStart(2, "0")}</b>
                      <span>{f.group}</span>
                      {fecha && <em>{`${fecha.dia} ${fecha.mes} ${fecha.anio}`}</em>}
                    </span>
                  </Clic>
                );
              })}
            </div>
          </div>
        )}
        {total > 0 && (
          <div className="ff-progreso">
            <span className="ff-progreso-n">
              <EditableNode id="ff-work-label" tag="span" className="ff-progreso-t">
                <EditableText id="ff-work-label" display="inline" />
              </EditableNode>
              <span>
                <span ref={cuenta}>01</span> / {String(total).padStart(2, "0")}
              </span>
            </span>
            <span className="ff-progreso-barra" aria-hidden>
              <span ref={barra} />
            </span>
            <span className="ff-progreso-pista">{fija ? "Scrolleá para recorrer →" : "Deslizá →"}</span>
          </div>
        )}
      </div>
    </section>
  );
}

/* ── Cifras ─────────────────────────────────────────────────────────────── */

/** Una cifra que cuenta desde cero cuando entra en pantalla. Una sola vez. */
function Cuenta({ id }: { id: string }) {
  const texto = aTexto(useContenido(id));
  const readOnly = useEditorStore((s) => s.readOnly);
  const reducido = useMovimientoReducido();
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    const c = partirCifra(texto);
    if (!el || !readOnly || reducido || !c) return;
    // Lo que ya está en pantalla al cargar no cuenta: se vería saltar.
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight && r.bottom > 0) return;
    // Se toca el nodo de texto que creó React, no textContent: así React
    // sigue siendo dueño del texto y lo actualiza si el fotógrafo lo cambia.
    const nodo = el.firstChild;
    if (!nodo) return;
    const escribir = (n: number) => {
      nodo.nodeValue = `${c.antes}${miles(n)}${c.despues}`;
    };
    escribir(0);
    let cuadro = 0;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        io.disconnect();
        const t0 = performance.now();
        const paso = (t: number) => {
          const x = Math.min((t - t0) / 1400, 1);
          escribir(Math.round(c.numero * (1 - Math.pow(1 - x, 3))));
          if (x < 1) cuadro = requestAnimationFrame(paso);
          else nodo.nodeValue = texto;
        };
        cuadro = requestAnimationFrame(paso);
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(cuadro);
      nodo.nodeValue = texto;
    };
  }, [texto, readOnly, reducido]);

  return <span ref={ref}>{texto}</span>;
}

function Cifras() {
  const v1 = useNodoVisible("ff-stat-1-value");
  const v2 = useNodoVisible("ff-stat-2-value");
  const v3 = useNodoVisible("ff-stat-3-value");
  const cifras = [v1 && 1, v2 && 2, v3 && 3].filter((n): n is number => Boolean(n));
  if (cifras.length === 0) return null;
  return (
    <section id="ff-cifras" className="ff-seccion ff-cifras">
      <Riel letra="A" id="ff-cifras-label" />
      <div className="ff-cuerpo">
        <EditableNode id="ff-cifras-text" tag="p" className="ff-cifras-texto" >
          <EditableText id="ff-cifras-text" />
        </EditableNode>
        <div className="ff-cifras-fila">
          {cifras.map((n) => (
            <div key={n} className="ff-cifra" data-rv="">
              <EditableNode id={`ff-stat-${n}-value`} className="ff-cifra-valor">
                <Cuenta id={`ff-stat-${n}-value`} />
              </EditableNode>
              <EditableNode id={`ff-stat-${n}-label`} className="ff-cifra-rotulo">
                <EditableText id={`ff-stat-${n}-label`} />
              </EditableNode>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Serie destacada ────────────────────────────────────────────────────── */

function Serie({ serie, alAbrir }: { serie: Proyecto | null; alAbrir: (fotos: FotoVisor[], i: number) => void }) {
  const eventos = useEditorStore((s) => s.perfil.eventos);
  const nombre = useEditorStore((s) => s.perfil.nombre);
  const readOnly = useEditorStore((s) => s.readOnly);
  const fino = usePunteroFino();
  const caja = useRef<HTMLDivElement>(null);
  const cursor = useRef<HTMLSpanElement>(null);
  const conCursor = fino && readOnly;

  // El cursor «Ver» sigue al puntero con un leve retraso (lerp 0.15).
  useEffect(() => {
    const c = caja.current;
    const v = cursor.current;
    if (!conCursor || !c || !v) return;
    let x = 0, y = 0, ax = 0, ay = 0, cuadro = 0, adentro = false;
    const paso = () => {
      ax += (x - ax) * 0.15;
      ay += (y - ay) * 0.15;
      v.style.translate = `${ax}px ${ay}px`;
      cuadro = adentro || Math.abs(x - ax) + Math.abs(y - ay) > 0.5 ? requestAnimationFrame(paso) : 0;
    };
    const mover = (e: PointerEvent) => {
      const r = c.getBoundingClientRect();
      x = e.clientX - r.left;
      y = e.clientY - r.top;
      if (!adentro) {
        adentro = true;
        ax = x;
        ay = y;
        v.dataset.ver = "";
      }
      cuadro ||= requestAnimationFrame(paso);
    };
    const salir = () => {
      adentro = false;
      delete v.dataset.ver;
    };
    c.addEventListener("pointermove", mover);
    c.addEventListener("pointerleave", salir);
    return () => {
      c.removeEventListener("pointermove", mover);
      c.removeEventListener("pointerleave", salir);
      cancelAnimationFrame(cuadro);
    };
  }, [conCursor]);

  if (!serie || serie.photos.length === 0) return null;
  const evento = eventos?.find((e) => e.nombre.trim().toLowerCase() === serie.title.trim().toLowerCase());
  const fecha = partesFecha(evento?.fecha ?? serie.photos[0]?.date);
  const visor = serie.photos.map((f) => ({ src: f.src, titulo: serie.title }));
  const ficha: [string, string][] = [
    ["Evento", serie.title],
    ...(evento?.lugar ? [["Lugar", evento.lugar] as [string, string]] : []),
    ...(evento?.disciplina ? [["Disciplina", evento.disciplina] as [string, string]] : []),
    ...(fecha ? [["Fecha", `${fecha.dia} ${fecha.mes} ${fecha.anio}`] as [string, string]] : []),
    ["Fotos", miles(serie.photos.length)],
    ["Fotógrafo", nombre],
  ];

  return (
    <section id="ff-serie" className="ff-seccion ff-serie">
      <div className="ff-serie-cab">
        <Riel letra="B" id="ff-serie-label" />
        <h2 className="ff-serie-titulo ff-titular" data-rv="">
          <span className="ff-linea" style={{ "--i": 0 } as React.CSSProperties}>
            <span>{serie.title}</span>
          </span>
        </h2>
        <Clic className="ff-serie-n" alActivar={() => alAbrir(visor, 0)}>
          {serie.photos.length} fotos →
        </Clic>
      </div>
      <div className="ff-serie-cuerpo">
        <div ref={caja} className="ff-serie-grande" data-cursor={conCursor ? "" : undefined}>
          <Clic className="ff-foto-fija" alActivar={() => alAbrir(visor, 0)} etiqueta="Ver la serie en grande" data-rv="">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={serie.photos[0]!.src} alt={serie.title} loading="lazy" />
          </Clic>
          {conCursor && (
            <span ref={cursor} className="ff-ver" aria-hidden>
              Ver
            </span>
          )}
        </div>
        <div className="ff-serie-lado">
          {serie.photos[1] && (
            <Clic className="ff-foto-fija ff-serie-chica" alActivar={() => alAbrir(visor, 1)} etiqueta="Ver la segunda foto en grande" data-rv="">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={serie.photos[1].src} alt={serie.title} loading="lazy" />
            </Clic>
          )}
          <dl className="ff-ficha">
            {ficha.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}

/* ── Índice de eventos ──────────────────────────────────────────────────── */

const SIN_EVENTOS: EventoSitio[] = [];

function Indice() {
  const eventos = useEditorStore((s) => s.perfil.eventos) ?? SIN_EVENTOS;
  const readOnly = useEditorStore((s) => s.readOnly);
  const fino = usePunteroFino();
  const lista = useRef<HTMLDivElement>(null);
  const mini = useRef<HTMLImageElement>(null);
  const [sobre, setSobre] = useState<number | null>(null);

  const anios = useMemo(() => {
    const grupos: { anio: string; filas: { e: (typeof eventos)[number]; i: number }[] }[] = [];
    eventos.forEach((e, i) => {
      const anio = partesFecha(e.fecha)?.anio ?? "Sin fecha";
      let g = grupos.find((x) => x.anio === anio);
      if (!g) grupos.push((g = { anio, filas: [] }));
      g.filas.push({ e, i });
    });
    return grupos;
  }, [eventos]);

  if (eventos.length === 0 && readOnly) return null;
  const portada = sobre === null ? null : eventos[sobre]?.portada;

  // La miniatura sigue al cursor sin pasar por React.
  const mover = (ev: React.PointerEvent) => {
    const fila = (ev.target as Element).closest<HTMLElement>("[data-ev]");
    const i = fila ? Number(fila.dataset.ev) : null;
    if (i !== sobre) setSobre(i);
    const caja = lista.current?.getBoundingClientRect();
    if (caja && mini.current) mini.current.style.translate = `${ev.clientX - caja.left}px ${ev.clientY - caja.top}px`;
  };

  return (
    <section id="ff-index" className="ff-seccion ff-indice">
      <Riel letra="C" id="ff-index-label">
        <EditableNode id="ff-index-intro" tag="p" className="ff-riel-p">
          <EditableText id="ff-index-intro" />
        </EditableNode>
      </Riel>
      <div className="ff-cuerpo">
        {eventos.length === 0 ? (
          <p className="ff-vacio">Cuando publiques eventos, aparecen acá con el link a su galería.</p>
        ) : (
          <div ref={lista} className="ff-indice-lista" onPointerMove={fino ? mover : undefined} onPointerLeave={() => setSobre(null)}>
            {anios.map((g) => (
              <div key={g.anio} className="ff-anio">
                <span className="ff-anio-n" data-rv="">{g.anio}</span>
                {g.filas.map(({ e, i }) => {
                  const f = partesFecha(e.fecha);
                  return (
                    <Clic key={e.href} href={e.href} className="ff-ev" data-ev={i} data-rv="">
                      <span className="ff-ev-nombre">
                        <i aria-hidden />
                        {e.nombre}
                      </span>
                      <span className="ff-ev-dato">{e.disciplina ?? "—"}</span>
                      <span className="ff-ev-dato">{f ? `${f.dia}.${f.mesNum}` : "—"}</span>
                      <span className="ff-ev-fotos">{miles(e.fotos)}</span>
                    </Clic>
                  );
                })}
              </div>
            ))}
            {fino && (
              // eslint-disable-next-line @next/next/no-img-element
              <img ref={mini} className="ff-indice-mini" src={portada ?? undefined} alt="" aria-hidden data-ver={portada ? "" : undefined} />
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/* ── Sobre mí ───────────────────────────────────────────────────────────── */

function SobreMi() {
  const { instagram, tienda, web } = useEnlaces();
  return (
    <section id="ff-about" className="ff-seccion ff-sobre">
      <Riel letra="D" id="ff-about-label" />
      <div className="ff-cuerpo ff-sobre-cuerpo">
        <div className="ff-sobre-retrato" data-rv="">
          <EditableNode id="ff-about-image" style={{ position: "absolute", inset: 0 }}>
            <EditableImage id="ff-about-image" imgStyle={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          </EditableNode>
        </div>
        <div className="ff-sobre-texto">
          <EditableNode id="ff-about-lead" tag="p" className="ff-sobre-lead">
            <EditableText id="ff-about-lead" />
          </EditableNode>
          <EditableNode id="ff-about-body" tag="p" className="ff-sobre-p">
            <EditableText id="ff-about-body" />
          </EditableNode>
          {(instagram ?? tienda ?? web) && (
            <div className="ff-sobre-links">
              {instagram && <Clic className="ff-subrayado ff-subrayado-acento" href={instagram} externo>Instagram ↗</Clic>}
              {tienda && <Clic className="ff-subrayado" href={tienda}>Galerías en encontrate ↗</Clic>}
              {web && <Clic className="ff-subrayado" href={web} externo>Web ↗</Clic>}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ── Contacto y pie ─────────────────────────────────────────────────────── */

function Contacto() {
  const { estado, alEnviar, porWhatsapp, readOnly } = useContacto();
  return (
    <section id="ff-contact" className="ff-contacto">
      <div className="ff-seccion-fila">
        <Riel letra="E" id="ff-contact-label" />
        <div className="ff-cuerpo">
          <EditableNode id="ff-contact-heading" tag="h2" className="ff-contacto-h ff-titular" >
            <span data-rv="" className="ff-titular-in">
              <Lineas id="ff-contact-heading" className="ff-linea" />
            </span>
          </EditableNode>
          <EditableNode id="ff-contact-body" tag="p" className="ff-contacto-p">
            <EditableText id="ff-contact-body" />
          </EditableNode>
        </div>
      </div>
      {estado === "enviado" ? (
        <p className="ff-enviado" role="status">
          {porWhatsapp ? "Abriendo WhatsApp…" : "Listo. Te respondo en el día."}
        </p>
      ) : (
        <form className="ff-form" onSubmit={alEnviar}>
          <label>
            <span>Nombre</span>
            <input name="name" required placeholder="Tu nombre" autoComplete="name" disabled={!readOnly} />
          </label>
          <label>
            <span>Email</span>
            <input name="email" type="email" required placeholder="tu@mail.com" autoComplete="email" disabled={!readOnly} />
          </label>
          <label className="ff-form-msj">
            <span>La carrera</span>
            <textarea name="message" required rows={1} placeholder="Fecha y lugar" disabled={!readOnly} />
          </label>
          <button type="submit" className="ff-pildora ff-enviar" disabled={estado === "mandando" || !readOnly}>
            {estado === "mandando" ? "Mandando…" : porWhatsapp ? "Mandar por WhatsApp →" : "Mandar consulta →"}
          </button>
          {estado === "error" && <p className="ff-form-error">No se pudo mandar. Probá de nuevo.</p>}
        </form>
      )}
    </section>
  );
}

function Pie() {
  const { instagram, whatsapp } = useEnlaces();
  return (
    <footer id="section-footer" className="ff-pie">
      <EditableNode id="ff-footer-copy" tag="span">
        <EditableText id="ff-footer-copy" display="inline" />
      </EditableNode>
      <div className="ff-pie-links">
        {instagram && <Clic href={instagram} externo>Instagram</Clic>}
        {whatsapp && <Clic href={whatsapp} externo>WhatsApp</Clic>}
        <Clic alActivar={() => irA("ff-hero")}>Volver arriba ↑</Clic>
      </div>
      <span>Hecho con encontrate</span>
    </footer>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */

export function FotofinishPlantilla({ viewport }: { viewport: Viewport }) {
  const selectNode = useEditorStore((s) => s.selectNode);
  const readOnly = useEditorStore((s) => s.readOnly);
  const galeria = useEditorStore((s) => s.galleryPhotos);
  const eventos = useEditorStore((s) => s.perfil.eventos);
  const proyectos = useProyectos();
  const visible = useSeccionVisible();
  const menu = useMenu();
  const raiz = useRef<HTMLDivElement>(null);
  const [visor, setVisor] = useState<{ fotos: FotoVisor[]; i: number } | null>(null);

  const serie = proyectos[0] ?? null;
  const tTrabajo = aTexto(useContenido("ff-work-label"));
  const tSerie = aTexto(useContenido("ff-serie-label"));
  const tIndice = aTexto(useContenido("ff-index-label"));
  const tSobre = aTexto(useContenido("ff-about-label"));
  const tContacto = aTexto(useContenido("ff-contact-label"));

  useRevelar(raiz, `${galeria.length}-${viewport}`);

  const abrir = (fotos: FotoVisor[], i: number) => {
    if (readOnly) setVisor({ fotos, i });
  };

  const enlaces: Enlace[] = [
    galeria.length > 0 && visible("ff-work") && { id: "ff-work", texto: tTrabajo },
    serie && visible("ff-serie") && { id: "ff-serie", texto: tSerie },
    (eventos?.length ?? 0) > 0 && visible("ff-index") && { id: "ff-index", texto: tIndice },
    visible("ff-about") && { id: "ff-about", texto: tSobre },
    visible("ff-contact") && { id: "ff-contact", texto: tContacto },
  ].filter((x): x is Enlace => Boolean(x));

  return (
    <div
      ref={raiz}
      className="ff"
      data-vp={viewport}
      data-editor={readOnly ? undefined : ""}
      onClick={() => selectNode(null)}
    >
      <Nav alAbrir={menu.abrir} abierto={menu.abierto} />
      <Portada />
      <Tira viewport={viewport} alAbrir={abrir} />
      <Cifras />
      <Serie serie={serie} alAbrir={abrir} />
      <Indice />
      <SobreMi />
      <Contacto />
      <Pie />
      {readOnly && <Menu menu={menu} enlaces={enlaces} serie={serie} />}
      {visor && <Visor fotos={visor.fotos} inicio={visor.i} alCerrar={() => setVisor(null)} />}
    </div>
  );
}
