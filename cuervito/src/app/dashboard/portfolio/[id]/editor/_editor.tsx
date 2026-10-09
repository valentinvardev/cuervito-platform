"use client";

import {
  ArrowLeft,
  Eye,
  EyeOff,
  ExternalLink,
  Lock,
  Monitor,
  Redo2,
  Smartphone,
  Tablet,
  Undo2,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "zustand";

import { FAMILIAS } from "~/app/_portfolio/familias";
import { htmlAMarcas, marcasAHtml } from "~/app/_portfolio/marcas";
import { PLANTILLAS } from "~/app/_portfolio/plantillas/registro";
import { Lienzo } from "~/app/_portfolio/sitio";
import {
  crearStoreSitio,
  type EstadoSitio,
  type FotoSitio,
  type PerfilSitio,
  type PortfolioDesign,
  ProveedorStore,
  srcDeImagen,
  type StoreSitio,
} from "~/app/_portfolio/store";
import type { GridSettings, Viewport } from "~/app/_portfolio/tipos";

import { guardarDisenoAction } from "../../acciones";

/** Lo que se guarda: la plantilla, lo tocado y el estilo. Ver EstadoSitio.tocados. */
function disenoDe(s: EstadoSitio): PortfolioDesign {
  return {
    templateId: s.templateId,
    nodes: Object.fromEntries(s.tocados.flatMap((id) => (s.nodes[id] ? [[id, s.nodes[id]]] : []))),
    palette: s.palette,
    typography: s.typography,
    buttons: s.buttons,
    grid: s.grid,
    contact: s.contact,
    hiddenSections: s.hiddenSections,
  };
}

/** Lo que vuelve al deshacer: todo lo que el editor puede cambiar. */
type Foto = Pick<EstadoSitio, "nodes" | "palette" | "typography" | "buttons" | "grid" | "contact" | "hiddenSections" | "tocados">;
const instantanea = (s: EstadoSitio): Foto => ({
  nodes: s.nodes,
  palette: s.palette,
  typography: s.typography,
  buttons: s.buttons,
  grid: s.grid,
  contact: s.contact,
  hiddenSections: s.hiddenSections,
  tocados: s.tocados,
});

const PARES = [
  { nombre: "Instrument · Geist", serif: FAMILIAS.instrumentSerif, sans: FAMILIAS.geist, mono: FAMILIAS.geistMono },
  { nombre: "Playfair · Manrope", serif: FAMILIAS.playfair, sans: FAMILIAS.manrope, mono: FAMILIAS.plexMono },
  { nombre: "Fraunces · Space Grotesk", serif: FAMILIAS.fraunces, sans: FAMILIAS.spaceGrotesk, mono: FAMILIAS.spaceMono },
  { nombre: "Anton · JetBrains Mono", serif: FAMILIAS.anton, sans: FAMILIAS.jetbrainsMono, mono: FAMILIAS.jetbrainsMono },
  { nombre: "Instrument Sans", serif: FAMILIAS.instrumentSans, sans: FAMILIAS.instrumentSans, mono: FAMILIAS.instrumentSans },
  { nombre: "Fraunces · Inter Tight", serif: FAMILIAS.fraunces, sans: FAMILIAS.interTight, mono: FAMILIAS.interTight },
];

const GRILLAS: Record<GridSettings["layout"], string> = {
  index: "Índice",
  mosaic: "Mosaico",
  uniform: "Grilla",
  masonry: "Cascada",
  corridor: "Carrusel 3D",
};

const ANCHOS: Record<Viewport, number | null> = { desktop: null, tablet: 820, mobile: 390 };

export function Editor(props: {
  portfolioId: string;
  nombre: string;
  url: string;
  publicado: boolean;
  diseno: PortfolioDesign;
  fotos: FotoSitio[];
  perfil: PerfilSitio;
}) {
  const [store] = useState<StoreSitio>(() =>
    crearStoreSitio({
      diseno: props.diseno,
      perfil: props.perfil,
      fotos: props.fotos,
      slug: null,
      soloLectura: false,
      viewport: "desktop",
    }),
  );

  return (
    <ProveedorStore value={store}>
      <Pantalla store={store} {...props} />
    </ProveedorStore>
  );
}

function Pantalla({
  store,
  portfolioId,
  nombre,
  url,
  publicado,
}: { store: StoreSitio } & Parameters<typeof Editor>[0]) {
  const viewport = useStore(store, (s) => s.viewport);
  const [pestana, setPestana] = useState<"secciones" | "diseno" | "contacto">("secciones");
  const [estado, setEstado] = useState<"guardado" | "guardando" | "error">("guardado");
  const [error, setError] = useState<string | null>(null);

  /* ── Guardado automático y deshacer ─────────────────────────────────── */
  const pasado = useRef<Foto[]>([]);
  const futuro = useRef<Foto[]>([]);
  const ultima = useRef<Foto>(instantanea(store.getState()));
  const aplicando = useRef(false);
  const [, forzar] = useState(0);

  const guardar = useCallback(() => {
    setEstado("guardando");
    void guardarDisenoAction(portfolioId, disenoDe(store.getState())).then((r) => {
      setEstado(r.error ? "error" : "guardado");
      setError(r.error);
    });
  }, [portfolioId, store]);

  useEffect(() => {
    let temporizador: ReturnType<typeof setTimeout> | null = null;
    const desuscribir = store.subscribe((s, antes) => {
      const cambioDiseno =
        s.nodes !== antes.nodes ||
        s.palette !== antes.palette ||
        s.typography !== antes.typography ||
        s.buttons !== antes.buttons ||
        s.grid !== antes.grid ||
        s.contact !== antes.contact ||
        s.hiddenSections !== antes.hiddenSections;
      if (!cambioDiseno) return;
      if (!aplicando.current) {
        pasado.current = [...pasado.current.slice(-60), ultima.current];
        futuro.current = [];
      }
      ultima.current = instantanea(s);
      forzar((n) => n + 1);
      setEstado("guardando");
      if (temporizador) clearTimeout(temporizador);
      temporizador = setTimeout(guardar, 900);
    });
    return () => {
      desuscribir();
      if (temporizador) clearTimeout(temporizador);
    };
  }, [store, guardar]);

  function viajar(de: React.MutableRefObject<Foto[]>, a: React.MutableRefObject<Foto[]>) {
    const f = de.current.at(-1);
    if (!f) return;
    de.current = de.current.slice(0, -1);
    a.current = [...a.current, instantanea(store.getState())];
    aplicando.current = true;
    store.setState(f);
    aplicando.current = false;
  }

  useEffect(() => {
    const teclas = (e: KeyboardEvent) => {
      const enCampo = (e.target as HTMLElement).closest("input, textarea");
      if (enCampo || !(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "z") return;
      e.preventDefault();
      if (e.shiftKey) viajar(futuro, pasado);
      else viajar(pasado, futuro);
    };
    window.addEventListener("keydown", teclas);
    return () => window.removeEventListener("keydown", teclas);
  });

  /* Antes de irse con cambios sin guardar, se avisa. */
  useEffect(() => {
    const avisar = (e: BeforeUnloadEvent) => {
      if (estado === "guardando") e.preventDefault();
    };
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [estado]);

  const ancho = ANCHOS[viewport];

  return (
    <div className="pfe">
      <header className="pfe-barra">
        <div className="pfe-izq">
          <Link href={`/dashboard/portfolio/${portfolioId}`} className="btn btn-ghost btn-icon btn-sm" aria-label="Volver al portfolio">
            <ArrowLeft />
          </Link>
          <div>
            <b>{nombre}</b>
            <small className={estado === "error" ? "mal" : ""}>
              {estado === "guardando" ? "Guardando…" : estado === "error" ? (error ?? "No se pudo guardar") : "Guardado"}
            </small>
          </div>
        </div>
        <div className="pfe-centro">
          <div className="seg" role="group" aria-label="Pantalla">
            {([
              ["desktop", Monitor, "Compu"],
              ["tablet", Tablet, "Tablet"],
              ["mobile", Smartphone, "Celular"],
            ] as const).map(([v, Icono, t]) => (
              <button key={v} type="button" aria-pressed={viewport === v} aria-label={t} data-tip={t} onClick={() => store.getState().setViewport(v)}>
                <Icono />
              </button>
            ))}
          </div>
          <button type="button" className="btn btn-quiet btn-icon btn-sm" aria-label="Deshacer" data-tip="Deshacer (Ctrl+Z)" disabled={pasado.current.length === 0} onClick={() => viajar(pasado, futuro)}>
            <Undo2 />
          </button>
          <button type="button" className="btn btn-quiet btn-icon btn-sm" aria-label="Rehacer" data-tip="Rehacer (Ctrl+Shift+Z)" disabled={futuro.current.length === 0} onClick={() => viajar(futuro, pasado)}>
            <Redo2 />
          </button>
        </div>
        <div className="pfe-der">
          <a href={url} target="_blank" rel="noopener" className="btn btn-ghost btn-sm">
            <ExternalLink /> {publicado ? "Ver página" : "Vista previa"}
          </a>
        </div>
      </header>

      <div className="pfe-cuerpo">
        <aside className="pfe-panel">
          <div className="seg pfe-pestanas" role="group" aria-label="Panel">
            {([
              ["secciones", "Secciones"],
              ["diseno", "Diseño"],
              ["contacto", "Contacto"],
            ] as const).map(([id, t]) => (
              <button key={id} type="button" aria-pressed={pestana === id} onClick={() => setPestana(id)}>
                {t}
              </button>
            ))}
          </div>
          {pestana === "secciones" && <Secciones store={store} />}
          {pestana === "diseno" && <Diseno store={store} />}
          {pestana === "contacto" && <Contacto store={store} />}
        </aside>

        <div className="pfe-lienzo" onClick={() => store.getState().selectNode(null)}>
          <div className="pfe-marco" style={ancho ? { width: ancho } : undefined} onClick={(e) => e.stopPropagation()}>
            <Lienzo store={store} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Secciones y el elemento elegido ─────────────────────────────────────── */

function Secciones({ store }: { store: StoreSitio }) {
  const templateId = useStore(store, (s) => s.templateId);
  const ocultas = useStore(store, (s) => s.hiddenSections);
  const elegido = useStore(store, (s) => s.selectedId);
  const secciones = PLANTILLAS[templateId].sections;
  const seccionDelElegido = secciones.find((x) => x.elements.some((e) => e.nodeId === elegido))?.id ?? null;
  const [abierta, setAbierta] = useState<string | null>(seccionDelElegido ?? secciones[1]?.id ?? null);

  useEffect(() => {
    if (seccionDelElegido) setAbierta(seccionDelElegido);
  }, [seccionDelElegido]);

  return (
    <div className="pfe-secciones">
      {elegido && <Elemento store={store} id={elegido} />}
      <ul>
        {secciones.map((sec) => {
          const oculta = ocultas.includes(sec.id);
          return (
            <li key={sec.id} data-abierta={abierta === sec.id}>
              <div className="pfe-sec">
                <button type="button" className="nombre" onClick={() => setAbierta((a) => (a === sec.id ? null : sec.id))} style={oculta ? { opacity: 0.5 } : undefined}>
                  {sec.label}
                </button>
                {sec.locked ? (
                  <span className="ico" data-tip="Siempre visible"><Lock /></span>
                ) : (
                  <button
                    type="button"
                    className="ico"
                    aria-label={oculta ? `Mostrar ${sec.label}` : `Ocultar ${sec.label}`}
                    data-tip={oculta ? "Mostrar" : "Ocultar"}
                    onClick={() => (oculta ? store.getState().showSection(sec.id) : store.getState().hideSection(sec.id))}
                  >
                    {oculta ? <EyeOff /> : <Eye />}
                  </button>
                )}
              </div>
              {abierta === sec.id && (
                <div className="pfe-elementos">
                  {sec.elements.map((el) => (
                    <button
                      key={el.nodeId}
                      type="button"
                      aria-current={elegido === el.nodeId}
                      onClick={() => {
                        store.getState().selectNode(el.nodeId);
                        document.querySelector(`[data-node-id="${el.nodeId}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                      }}
                    >
                      {el.label}
                    </button>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {!elegido && <p className="pista pfe-ayuda">Tocá cualquier texto o foto del sitio para cambiarlo. El ojo oculta una sección sin borrarla.</p>}
    </div>
  );
}

function Elemento({ store, id }: { store: StoreSitio; id: string }) {
  const nodo = useStore(store, (s) => s.nodes[id]);
  const fotos = useStore(store, (s) => s.galleryPhotos);
  const templateId = useStore(store, (s) => s.templateId);
  const etiqueta = useMemo(
    () => PLANTILLAS[templateId].sections.flatMap((x) => x.elements).find((e) => e.nodeId === id)?.label ?? "Elemento",
    [templateId, id],
  );
  const [texto, setTexto] = useState(() => htmlAMarcas(nodo?.content ?? ""));
  const campo = useRef<HTMLTextAreaElement>(null);

  // Al elegir otro elemento, su texto; y el foco, para escribir de una.
  useEffect(() => {
    setTexto(htmlAMarcas(store.getState().nodes[id]?.content ?? ""));
    campo.current?.focus();
  }, [id, store]);

  if (!nodo) return null;

  if (nodo.type === "image") {
    const actual = srcDeImagen(nodo.src, fotos);
    return (
      <div className="pfe-elemento">
        <div className="pfe-elemento-h">
          <span>{etiqueta}</span>
          <button type="button" className="btn btn-quiet btn-sm" onClick={() => store.getState().selectNode(null)}>Listo</button>
        </div>
        <div className="pfe-fotos">
          {fotos
            .filter((f) => f.id)
            .map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={f.src === actual}
                onClick={() => store.getState().updateNode(id, { src: `foto:${f.id}` })}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.src} alt="" loading="lazy" />
              </button>
            ))}
        </div>
      </div>
    );
  }

  return (
    <div className="pfe-elemento">
      <div className="pfe-elemento-h">
        <span>{etiqueta}</span>
        <button type="button" className="btn btn-quiet btn-sm" onClick={() => store.getState().selectNode(null)}>Listo</button>
      </div>
      <textarea
        ref={campo}
        className="ta"
        rows={Math.min(8, Math.max(2, texto.split("\n").length + 1))}
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          store.getState().updateNode(id, { content: marcasAHtml(e.target.value) });
        }}
      />
      <span className="pista">*cursiva*, **negrita** y Enter para cortar la línea.</span>
    </div>
  );
}

/* ── Diseño ──────────────────────────────────────────────────────────────── */

function Diseno({ store }: { store: StoreSitio }) {
  const palette = useStore(store, (s) => s.palette);
  const typography = useStore(store, (s) => s.typography);
  const grid = useStore(store, (s) => s.grid);
  const buttons = useStore(store, (s) => s.buttons);
  const templateId = useStore(store, (s) => s.templateId);
  const tpl = PLANTILLAS[templateId];
  const layouts = tpl.layouts ?? ["mosaic", "uniform", "masonry"];
  const s = store.getState();

  return (
    <div className="pfe-diseno">
      <section>
        <h3>Colores</h3>
        {([
          ["bg", "Fondo"],
          ["fg", "Texto"],
          ["accent", "Acento"],
          ["muted", "Secundario"],
        ] as const).map(([k, t]) => (
          <label key={k} className="pfe-color">
            <input type="color" value={palette[k]} onChange={(e) => s.setPalette({ [k]: e.target.value.toUpperCase() })} />
            <span>{t}</span>
            <code>{palette[k]}</code>
          </label>
        ))}
        {tpl.defaultPalette && (
          <button type="button" className="btn btn-quiet btn-sm" onClick={() => s.setPalette(tpl.defaultPalette!)}>
            Volver a los de {tpl.name}
          </button>
        )}
      </section>

      <section>
        <h3>Letras</h3>
        {PARES.map((p) => (
          <button
            key={p.nombre}
            type="button"
            className="pfe-letra"
            aria-pressed={typography.serif === p.serif && typography.sans === p.sans}
            onClick={() => s.setTypography({ serif: p.serif, sans: p.sans, mono: p.mono })}
          >
            <span style={{ fontFamily: p.serif }}>Aa</span>
            <small>{p.nombre}</small>
          </button>
        ))}
      </section>

      {layouts.length > 0 && (
      <section>
        <h3>Cómo se muestran las fotos</h3>
        <div className="chips">
          {layouts.map((l) => (
            <button key={l} type="button" className="chip-f" aria-pressed={grid.layout === l} onClick={() => s.setGrid({ layout: l })}>
              {GRILLAS[l]}
            </button>
          ))}
        </div>
        {(grid.layout === "uniform" || grid.layout === "masonry") && (
          <label className="pfe-rango">
            <span>Columnas</span>
            <input type="range" min={2} max={5} value={grid.columns} onChange={(e) => s.setGrid({ columns: Number(e.target.value) })} />
            <b>{grid.columns}</b>
          </label>
        )}
        {grid.layout !== "index" && grid.layout !== "corridor" && (
          <label className="pfe-rango">
            <span>Separación</span>
            <input type="range" min={0} max={32} value={grid.gap} onChange={(e) => s.setGrid({ gap: Number(e.target.value) })} />
            <b>{grid.gap}px</b>
          </label>
        )}
      </section>
      )}

      <section>
        <h3>Botones</h3>
        <label className="pfe-rango">
          <span>Esquinas</span>
          <input type="range" min={0} max={24} value={buttons.radius} onChange={(e) => s.setButtons({ radius: Number(e.target.value) })} />
          <b>{buttons.radius}px</b>
        </label>
      </section>
    </div>
  );
}

/* ── Contacto ────────────────────────────────────────────────────────────── */

function Contacto({ store }: { store: StoreSitio }) {
  const contact = useStore(store, (s) => s.contact);
  const s = store.getState();
  return (
    <div className="pfe-diseno">
      <section>
        <h3>Adónde llegan las consultas</h3>
        <div className="seg" role="group" style={{ width: "100%" }}>
          <button type="button" aria-pressed={contact.mode === "inbox"} onClick={() => s.setContact({ mode: "inbox" })}>
            A mi mail y al panel
          </button>
          <button type="button" aria-pressed={contact.mode === "whatsapp"} onClick={() => s.setContact({ mode: "whatsapp" })}>
            A WhatsApp
          </button>
        </div>
        {contact.mode === "inbox" ? (
          <p className="pista">Cada consulta te llega por mail y queda en la pestaña Consultas del portfolio.</p>
        ) : (
          <>
            <div className="campo">
              <label htmlFor="pfe-wa">Tu número</label>
              <input id="pfe-wa" className="inp" inputMode="tel" placeholder="+54 9 351 000 0000" value={contact.whatsapp} maxLength={30} onChange={(e) => s.setContact({ whatsapp: e.target.value.replace(/[^\d +()-]/g, "") })} />
            </div>
            <div className="campo">
              <label htmlFor="pfe-wa-t">Mensaje que se arma</label>
              <textarea id="pfe-wa-t" className="ta" rows={4} value={contact.waTemplate} maxLength={1000} onChange={(e) => s.setContact({ waTemplate: e.target.value })} />
              <span className="pista">{"{name}"}, {"{email}"} y {"{message}"} se reemplazan por lo que escribió el visitante.</span>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
