"use client";

/**
 * Parcial — planilla de cronometraje: casi blanco, tinta, naranja señal y
 * Geist para todo.
 *
 * La portada es una foto a sangre con el título abajo a la izquierda. Debajo,
 * los «parciales» (las cifras de encontrate) como una fila de tiempos que
 * cuentan desde cero; el trabajo en grilla pareja con filtro por evento; los
 * eventos como una planilla de resultados, con una barra naranja que corre
 * por la fila al pasar; el contacto en un bloque de tinta. Un reloj corre en
 * la nav, porque una planilla siempre tiene hora.
 *
 * Lo responsive sale de `viewport` (data-vp), no de media queries, igual que
 * en las otras plantillas.
 */

import "./parcial.css";

import { useEffect, useMemo, useRef, useState } from "react";

import { EditableImage, EditableNode, EditableText, LogoImage } from "../primitivas";
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
  useProyectos,
  useRevelar,
  useSeccionVisible,
  Visor,
  type FotoVisor,
} from "./comun";

/** Fotos por tanda en la grilla de trabajo. */
const PASO = 12;

/* ── Marca y reloj ──────────────────────────────────────────────────────── */

function Marca() {
  const logo = useEditorStore((s) => s.logo);
  if (logo.mode === "image" && logo.imageUrl) {
    return <LogoImage src={logo.imageUrl} alt={logo.text} width={logo.width} crop={logo.imageCrop} />;
  }
  return (
    <span className="pc-marca">
      {logo.mode === "image+text" && logo.imageUrl && <LogoImage src={logo.imageUrl} width={logo.width} crop={logo.imageCrop} />}
      <EditableNode id="pc-nav-brand" tag="span" className="pc-marca-nombre">
        <EditableText id="pc-nav-brand" display="inline" />
      </EditableNode>
    </span>
  );
}

const dos = (n: number) => String(n).padStart(2, "0");

/**
 * La hora del visitante, segundo a segundo. Arranca en ceros y se pone en hora
 * al montar: la hora del servidor no es la del navegador, y escribirla en el
 * HTML sería un error de hidratación seguro.
 */
function Reloj() {
  const [hora, setHora] = useState<string | null>(null);
  useEffect(() => {
    const poner = () => {
      const d = new Date();
      setHora(`${dos(d.getHours())}:${dos(d.getMinutes())}:${dos(d.getSeconds())}`);
    };
    poner();
    const t = window.setInterval(poner, 1000);
    return () => window.clearInterval(t);
  }, []);
  return (
    <span className="pc-reloj" aria-hidden>
      {hora ?? "00:00:00"}
    </span>
  );
}

/** El número del rótulo, para el menú: nada si lo quitaron. */
function useNumero(id: string): string {
  const n = useEditorStore((s) => s.nodes[id]);
  return n?.hidden ? "" : aTexto(n?.content ?? "").trim();
}

/** El rótulo de sección: el número y el texto, los dos editables. */
function Rotulo({ nId, id }: { nId: string; id: string }) {
  return (
    <div className="pc-rotulo">
      <EditableNode id={nId} tag="span" className="pc-rotulo-n">
        <EditableText id={nId} display="inline" />
      </EditableNode>
      <EditableNode id={id} tag="span" className="pc-rotulo-t">
        <EditableText id={id} display="inline" />
      </EditableNode>
    </div>
  );
}

/* ── Nav y menú ─────────────────────────────────────────────────────────── */

type Enlace = { id: string; texto: string; numero: string };

function Nav({ alAbrir, abierto }: { alAbrir: () => void; abierto: boolean }) {
  return (
    <nav id="section-nav" className="pc-nav">
      <div className="pc-nav-marca">
        <Marca />
      </div>
      <div className="pc-nav-centro">
        <i className="pc-latido" aria-hidden />
        <EditableNode id="pc-nav-estado" tag="span" className="pc-nav-estado">
          <EditableText id="pc-nav-estado" display="inline" />
        </EditableNode>
      </div>
      <div className="pc-nav-der">
        <Reloj />
        <Clic className="pc-menu-btn" alActivar={alAbrir} etiqueta="Abrir el menú" expandido={abierto}>
          <span>Menú</span>
          <span className="pc-hamburguesa" aria-hidden>
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
    <div className="pc-menu-capa" data-abierto={menu.abierto ? "" : undefined}>
      <div className="pc-menu-velo" onClick={menu.cerrar} aria-hidden />
      <div ref={menu.panel} className="pc-menu" inert={!menu.abierto} role="dialog" aria-modal="true" aria-label="Menú">
        <div className="pc-menu-cab">
          <span>
            <i className="pc-latido" aria-hidden /> Planilla
          </span>
          <button type="button" className="pc-menu-cerrar" onClick={menu.cerrar}>
            Cerrar <span aria-hidden>✕</span>
          </button>
        </div>
        <nav className="pc-menu-links">
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
              <span className="pc-menu-n">{l.numero}</span>
              <span className="pc-menu-t">{l.texto}</span>
              <span className="pc-menu-flecha" aria-hidden>→</span>
            </a>
          ))}
        </nav>
        {(links.instagram ?? links.whatsapp ?? links.tienda) && (
          <div className="pc-menu-redes">
            {links.instagram && <a href={links.instagram} target="_blank" rel="noopener noreferrer">Instagram ↗</a>}
            {links.whatsapp && <a href={links.whatsapp} target="_blank" rel="noopener noreferrer">WhatsApp ↗</a>}
            {links.tienda && <a href={links.tienda}>Galerías ↗</a>}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Portada ────────────────────────────────────────────────────────────── */

function Portada() {
  return (
    <section id="pc-hero" className="pc-hero">
      <div className="pc-hero-foto">
        <EditableNode id="pc-hero-image" style={{ position: "absolute", inset: 0 }}>
          <EditableImage id="pc-hero-image" imgStyle={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        </EditableNode>
      </div>
      <div className="pc-hero-velo" aria-hidden />
      <EditableNode id="pc-hero-eyebrow" tag="span" className="pc-hero-volanta">
        <EditableText id="pc-hero-eyebrow" display="inline" />
      </EditableNode>
      <div className="pc-hero-abajo">
        <EditableNode id="pc-hero-title" tag="h1" className="pc-hero-titulo">
          <Lineas id="pc-hero-title" className="pc-linea" />
        </EditableNode>
        <div className="pc-hero-lado">
          <EditableNode id="pc-hero-sub" tag="p" className="pc-hero-sub">
            <EditableText id="pc-hero-sub" />
          </EditableNode>
          <EditableNode id="pc-hero-meta" tag="span" className="pc-hero-meta">
            <EditableText id="pc-hero-meta" display="inline" />
          </EditableNode>
        </div>
      </div>
    </section>
  );
}

/* ── Parciales ──────────────────────────────────────────────────────────── */

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
    // El nodo de texto de React, no textContent: React sigue siendo su dueño.
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
          const x = Math.min((t - t0) / 1200, 1);
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

function Parciales() {
  const v1 = useNodoVisible("pc-stat-1-value");
  const v2 = useNodoVisible("pc-stat-2-value");
  const v3 = useNodoVisible("pc-stat-3-value");
  const cifras = [v1 && 1, v2 && 2, v3 && 3].filter((n): n is number => Boolean(n));
  if (cifras.length === 0) return null;
  return (
    <section id="pc-splits" className="pc-seccion pc-parciales">
      <Rotulo nId="pc-splits-num" id="pc-splits-label" />
      <div className="pc-parciales-fila" style={{ "--n": cifras.length } as React.CSSProperties}>
        {cifras.map((n, i) => (
          <div key={n} className="pc-parcial" data-rv="" style={{ "--i": i } as React.CSSProperties}>
            <span className="pc-parcial-p">P{i + 1}</span>
            <EditableNode id={`pc-stat-${n}-value`} className="pc-parcial-valor">
              <Cuenta id={`pc-stat-${n}-value`} />
            </EditableNode>
            <EditableNode id={`pc-stat-${n}-label`} className="pc-parcial-rotulo">
              <EditableText id={`pc-stat-${n}-label`} />
            </EditableNode>
            <span className="pc-parcial-barra" aria-hidden />
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── Trabajo ────────────────────────────────────────────────────────────── */

function Trabajo({ alAbrir }: { alAbrir: (fotos: FotoVisor[], i: number) => void }) {
  const galeria = useEditorStore((s) => s.galleryPhotos);
  const readOnly = useEditorStore((s) => s.readOnly);
  const proyectos = useProyectos();
  const [filtro, setFiltro] = useState<string | null>(null);
  const [cuantas, setCuantas] = useState(PASO);

  const fotos = useMemo(
    () => (filtro ? galeria.filter((f) => (f.group?.trim() ?? "") === filtro) : galeria),
    [galeria, filtro],
  );
  if (galeria.length === 0 && readOnly) return null;
  const visibles = fotos.slice(0, cuantas);
  const visor = fotos.map((f) => ({ src: f.src, titulo: f.group }));
  const grupos = proyectos.filter((p) => p.title !== "Trabajo" || proyectos.length > 1);

  return (
    <section id="pc-work" className="pc-seccion pc-trabajo">
      <div className="pc-trabajo-cab">
        <Rotulo nId="pc-work-num" id="pc-work-label" />
        <EditableNode id="pc-work-title" tag="h2" className="pc-titular">
          <span data-rv="" className="pc-titular-in">
            <Lineas id="pc-work-title" className="pc-linea" />
          </span>
        </EditableNode>
      </div>

      {grupos.length > 1 && (
        <div className="pc-filtros" role="group" aria-label="Filtrar por evento">
          <Clic className="pc-filtro" data-activo={filtro === null ? "" : undefined} alActivar={() => { setFiltro(null); setCuantas(PASO); }}>
            Todo <b>{miles(galeria.length)}</b>
          </Clic>
          {grupos.map((p) => (
            <Clic
              key={p.id}
              className="pc-filtro"
              data-activo={filtro === p.title ? "" : undefined}
              alActivar={() => { setFiltro(p.title); setCuantas(PASO); }}
            >
              {p.title} <b>{miles(p.photos.length)}</b>
            </Clic>
          ))}
        </div>
      )}

      {galeria.length === 0 ? (
        <p className="pc-vacio">Las fotos que elijas para el portfolio aparecen acá.</p>
      ) : (
        <div className="pc-grilla">
          {visibles.map((f, i) => {
            const fecha = partesFecha(f.date);
            return (
              <Clic
                key={`${f.src}-${i}`}
                className="pc-foto"
                data-rv=""
                alActivar={() => alAbrir(visor, i)}
                etiqueta={`Ver la foto ${i + 1} en grande`}
              >
                <span className="pc-foto-caja">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.src} alt={f.group ?? ""} loading={i < 6 ? "eager" : "lazy"} />
                </span>
                <span className="pc-foto-pie">
                  <b>#{dos(i + 1)}</b>
                  <span>{f.group}</span>
                  {fecha && <em>{`${fecha.dia}.${fecha.mesNum}.${fecha.anio.slice(2)}`}</em>}
                </span>
              </Clic>
            );
          })}
        </div>
      )}

      {fotos.length > cuantas && (
        <div className="pc-mas">
          <Clic className="pc-boton pc-boton-linea" alActivar={() => setCuantas((n) => n + PASO)}>
            Ver más fotos <span aria-hidden>↓</span>
          </Clic>
          <span className="pc-mas-n">
            {miles(visibles.length)} / {miles(fotos.length)}
          </span>
        </div>
      )}
    </section>
  );
}

/* ── Planilla de eventos ────────────────────────────────────────────────── */

const SIN_EVENTOS: EventoSitio[] = [];

function Planilla() {
  const eventos = useEditorStore((s) => s.perfil.eventos) ?? SIN_EVENTOS;
  const readOnly = useEditorStore((s) => s.readOnly);
  if (eventos.length === 0 && readOnly) return null;

  return (
    <section id="pc-events" className="pc-seccion pc-planilla">
      <div className="pc-planilla-cab">
        <Rotulo nId="pc-events-num" id="pc-events-label" />
        <EditableNode id="pc-events-intro" tag="p" className="pc-planilla-intro">
          <EditableText id="pc-events-intro" />
        </EditableNode>
      </div>
      {eventos.length === 0 ? (
        <p className="pc-vacio">Cuando publiques eventos, aparecen acá con el link a su galería.</p>
      ) : (
        <div className="pc-tabla" role="table" aria-label="Eventos">
          <div className="pc-fila pc-fila-cab" role="row">
            <span role="columnheader">Pos</span>
            <span role="columnheader">Fecha</span>
            <span role="columnheader">Evento</span>
            <span role="columnheader">Disciplina</span>
            <span role="columnheader">Lugar</span>
            <span role="columnheader" className="pc-der">Fotos</span>
          </div>
          {eventos.map((e, i) => {
            const f = partesFecha(e.fecha);
            return (
              <Clic key={e.href} href={e.href} className="pc-fila pc-ev" data-rv="" style={{ "--i": i } as React.CSSProperties}>
                <span className="pc-ev-pos">{dos(i + 1)}</span>
                <span className="pc-ev-fecha">{f ? `${f.dia}.${f.mesNum}.${f.anio}` : "—"}</span>
                <span className="pc-ev-nombre">{e.nombre}</span>
                <span className="pc-ev-dato">{e.disciplina ?? "—"}</span>
                <span className="pc-ev-dato">{e.lugar ?? "—"}</span>
                <span className="pc-ev-fotos pc-der">
                  {miles(e.fotos)} <i aria-hidden>→</i>
                </span>
              </Clic>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* ── Sobre mí ───────────────────────────────────────────────────────────── */

function SobreMi() {
  const { instagram, tienda, web } = useEnlaces();
  return (
    <section id="pc-about" className="pc-seccion pc-sobre">
      <Rotulo nId="pc-about-num" id="pc-about-label" />
      <div className="pc-sobre-cuerpo">
        <div className="pc-sobre-retrato" data-rv="">
          <EditableNode id="pc-about-image" style={{ position: "absolute", inset: 0 }}>
            <EditableImage id="pc-about-image" imgStyle={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          </EditableNode>
        </div>
        <div className="pc-sobre-texto">
          <EditableNode id="pc-about-lead" tag="p" className="pc-sobre-lead">
            <EditableText id="pc-about-lead" />
          </EditableNode>
          <EditableNode id="pc-about-body" tag="p" className="pc-sobre-p">
            <EditableText id="pc-about-body" />
          </EditableNode>
          {(instagram ?? tienda ?? web) && (
            <div className="pc-sobre-links">
              {instagram && <Clic className="pc-enlace" href={instagram} externo>Instagram ↗</Clic>}
              {tienda && <Clic className="pc-enlace" href={tienda}>Galerías en encontrate ↗</Clic>}
              {web && <Clic className="pc-enlace" href={web} externo>Web ↗</Clic>}
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
    <section id="pc-contact" className="pc-contacto">
      <div className="pc-contacto-cab">
        <Rotulo nId="pc-contact-num" id="pc-contact-label" />
        <EditableNode id="pc-contact-heading" tag="h2" className="pc-contacto-h">
          <span data-rv="" className="pc-titular-in">
            <Lineas id="pc-contact-heading" className="pc-linea" />
          </span>
        </EditableNode>
        <EditableNode id="pc-contact-body" tag="p" className="pc-contacto-p">
          <EditableText id="pc-contact-body" />
        </EditableNode>
      </div>
      {estado === "enviado" ? (
        <p className="pc-enviado" role="status">
          {porWhatsapp ? "Abriendo WhatsApp…" : "Listo. Te respondo en el día."}
        </p>
      ) : (
        <form className="pc-form" onSubmit={alEnviar}>
          <label>
            <span>01 · Nombre</span>
            <input name="name" required placeholder="Tu nombre" autoComplete="name" disabled={!readOnly} />
          </label>
          <label>
            <span>02 · Email</span>
            <input name="email" type="email" required placeholder="tu@mail.com" autoComplete="email" disabled={!readOnly} />
          </label>
          <label className="pc-form-msj">
            <span>03 · La carrera</span>
            <textarea name="message" required rows={1} placeholder="Fecha, lugar y cantidad de corredores" disabled={!readOnly} />
          </label>
          <button type="submit" className="pc-boton pc-enviar" disabled={estado === "mandando" || !readOnly}>
            {estado === "mandando" ? "Mandando…" : porWhatsapp ? "Mandar por WhatsApp →" : "Mandar consulta →"}
          </button>
          {estado === "error" && <p className="pc-form-error">No se pudo mandar. Probá de nuevo.</p>}
        </form>
      )}
    </section>
  );
}

function Pie() {
  const { instagram, whatsapp } = useEnlaces();
  return (
    <footer id="section-footer" className="pc-pie">
      <EditableNode id="pc-footer-copy" tag="span">
        <EditableText id="pc-footer-copy" display="inline" />
      </EditableNode>
      <div className="pc-pie-links">
        {instagram && <Clic href={instagram} externo>Instagram</Clic>}
        {whatsapp && <Clic href={whatsapp} externo>WhatsApp</Clic>}
        <Clic alActivar={() => irA("pc-hero")}>Volver arriba ↑</Clic>
      </div>
      <span>Hecho con encontrate</span>
    </footer>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */

export function ParcialPlantilla({ viewport }: { viewport: Viewport }) {
  const selectNode = useEditorStore((s) => s.selectNode);
  const readOnly = useEditorStore((s) => s.readOnly);
  const galeria = useEditorStore((s) => s.galleryPhotos);
  const eventos = useEditorStore((s) => s.perfil.eventos);
  const visible = useSeccionVisible();
  const menu = useMenu();
  const raiz = useRef<HTMLDivElement>(null);
  const [visor, setVisor] = useState<{ fotos: FotoVisor[]; i: number } | null>(null);

  const tTrabajo = aTexto(useContenido("pc-work-label"));
  const tEventos = aTexto(useContenido("pc-events-label"));
  const tSobre = aTexto(useContenido("pc-about-label"));
  const tContacto = aTexto(useContenido("pc-contact-label"));
  const nTrabajo = useNumero("pc-work-num");
  const nEventos = useNumero("pc-events-num");
  const nSobre = useNumero("pc-about-num");
  const nContacto = useNumero("pc-contact-num");

  useRevelar(raiz, `${galeria.length}-${viewport}`);

  const abrir = (fotos: FotoVisor[], i: number) => {
    if (readOnly) setVisor({ fotos, i });
  };

  const enlaces: Enlace[] = [
    galeria.length > 0 && visible("pc-work") && { id: "pc-work", texto: tTrabajo, numero: nTrabajo },
    (eventos?.length ?? 0) > 0 && visible("pc-events") && { id: "pc-events", texto: tEventos, numero: nEventos },
    visible("pc-about") && { id: "pc-about", texto: tSobre, numero: nSobre },
    visible("pc-contact") && { id: "pc-contact", texto: tContacto, numero: nContacto },
  ].filter((x): x is Enlace => Boolean(x));

  return (
    <div
      ref={raiz}
      className="pc"
      data-vp={viewport}
      data-editor={readOnly ? undefined : ""}
      onClick={() => selectNode(null)}
    >
      <Nav alAbrir={menu.abrir} abierto={menu.abierto} />
      <Portada />
      <Parciales />
      <Trabajo alAbrir={abrir} />
      <Planilla />
      <SobreMi />
      <Contacto />
      <Pie />
      {/* También en el editor: el dueño tiene que poder ver el menú abierto. */}
      <Menu menu={menu} enlaces={enlaces} />
      {visor && <Visor fotos={visor.fotos} inicio={visor.i} alCerrar={() => setVisor(null)} />}
    </div>
  );
}
