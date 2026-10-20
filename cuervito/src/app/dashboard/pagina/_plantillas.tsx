"use client";

import { LayoutTemplate, Monitor, Pipette, Smartphone, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  PLANTILLA_POR_DEFECTO,
  TEMPLATES,
  acento2De,
  acentoDe,
  getTemplate,
  paletaDePlantilla,
  tonoDePlantilla,
  type StorefrontTemplate,
} from "~/lib/storefront-templates";

/**
 * La plantilla de la página: la que está en uso, en la tarjeta, y un diálogo
 * para explorar las demás.
 *
 * Antes la tarjeta mostraba tres miniaturas abstractas lado a lado —clara,
 * oscura, editorial— y elegir era adivinar: la miniatura decía el color y
 * nada más, y recién después de guardar se veía en la previa si la página
 * quedaba bien. Encima el catálogo tiene diez plantillas y ahí entraban tres.
 *
 * Ahora la tarjeta dice cuál usás y de qué va. Las demás se exploran en un
 * diálogo donde cada una se ve ARMADA CON TU PÁGINA —tu logo, tus eventos,
 * tu color— antes de aplicarla, y donde el color se cambia mirando: se mira
 * primero y se decide después, que es el orden en que uno elige cualquier
 * cosa que va a mostrar.
 */

/** Los presets de color. Los mismos de la tarjeta de color del editor. */
export const COLORES = ["#F0410F", "#1E7A4D", "#1F5FBF", "#8B3FC4", "#12110F", "#C2185B"];

/** El color de marca y, en las plantillas de dos, el secundario. */
export type Colores = { color: string; color2: string | null };

/* El orden de la lista es el de recomendación, no el del catálogo: la de
   encontrate primero porque es la de por defecto, después las cinco con
   tema, y las tres viejas y el feed al final. Lo que el catálogo sume y acá
   no esté nombrado va al final, para que una plantilla nueva no quede
   escondida por olvido. */
const ORDEN: readonly string[] = [
  "encontrate", "pista", "podio", "noche", "cancha", "tablero", "velvet", "dark", "light", "sport", "feed",
];
const LISTA: readonly StorefrontTemplate[] = [
  ...ORDEN.flatMap((id) => TEMPLATES.filter((t) => t.id === id)),
  ...TEMPLATES.filter((t) => !ORDEN.includes(t.id)),
];

// Ancho con el que se renderiza la página adentro del iframe antes de reducir.
const ANCHO_ESCRITORIO = 1280;
const ANCHO_TELEFONO = 390;

const igual = (a: string | null, b: string | null) =>
  (a ?? "").toUpperCase() === (b ?? "").toUpperCase();

/**
 * Lo que la plantilla dibuja de verdad con lo que el fotógrafo tiene guardado:
 * sin color elegido, el acento de fábrica de la plantilla; sin secundario, el
 * de fábrica (o ninguno si la plantilla lleva uno solo).
 */
function coloresEfectivos(t: StorefrontTemplate, color: string | null, color2: string | null): Colores {
  return {
    color: color ?? acentoDe(t),
    color2: t.tema?.dosColores ? (color2 ?? acento2De(t)) : null,
  };
}

export function Plantillas({
  actual,
  color,
  color2,
  onElegir,
}: {
  /** El id de la plantilla en uso. */
  actual: string;
  /** El color de marca guardado. Null si nunca eligió: va el de la plantilla. */
  color: string | null;
  /** El secundario guardado, para las plantillas de dos colores. */
  color2: string | null;
  /** Guarda la elegida con sus colores. Devuelve si se pudo. */
  onElegir: (id: string, colores: Colores | null) => Promise<boolean>;
}) {
  const [abierto, setAbierto] = useState(false);
  const cerrar = useCallback(() => setAbierto(false), []);
  const t = getTemplate(actual);
  const efectivos = coloresEfectivos(t, color, color2);

  return (
    <>
      <div className="plt-act">
        <Miniatura t={t} color={efectivos.color} color2={efectivos.color2} />
        <div className="plt-act-t">
          <b>{t.name}</b>
          <span>{t.description}</span>
          <Etiquetas t={t} />
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAbierto(true)}>
          <LayoutTemplate /> Explorar plantillas
        </button>
      </div>

      {abierto && (
        <ExplorarPlantillas
          enUso={actual}
          color={color}
          color2={color2}
          onElegir={onElegir}
          onCerrar={cerrar}
        />
      )}
    </>
  );
}

/** Lo que se dice de una plantilla en dos palabras. Medido, no escrito a mano. */
function Etiquetas({ t }: { t: StorefrontTemplate }) {
  return (
    <span className="plt-chips">
      <i>{tonoDePlantilla(t) === "clara" ? "Clara" : "Oscura"}</i>
      {t.tema?.dosColores && <i>Dos colores</i>}
      {t.layout === "feed" && <i>Para teléfono</i>}
      {t.id === PLANTILLA_POR_DEFECTO && <i>Por defecto</i>}
    </span>
  );
}

/**
 * Una página dibujada en chico con la paleta REAL de la plantilla: los
 * colores salen de sus variables, así que si una cambia de fondo la miniatura
 * cambia sola. La estructura la decide la familia (encontrate, cobertura,
 * feed) o, en las cinco con tema, el tema mismo: es lo que de verdad las
 * distingue a simple vista.
 */
export function Miniatura({
  t,
  color,
  color2,
}: {
  t: StorefrontTemplate;
  color: string;
  color2?: string | null;
}) {
  const p = paletaDePlantilla(t);
  const estilo = {
    "--mn-bg": p.fondo,
    "--mn-sup": p.superficie,
    "--mn-tx": p.texto,
    "--mn-tx2": p.texto2,
    "--mn-ln": p.linea,
    "--mn-acc": color,
    "--mn-acc2": color2 ?? color,
  } as React.CSSProperties;

  const tarjetas = Array.from({ length: 3 }).map((_, i) => (
    <i className="mn-card" key={i}>
      <i className="mn-ph" />
      <i className="mn-ln" />
    </i>
  ));
  const filas = Array.from({ length: 3 }).map((_, i) => (
    <i className="mn-fila" key={i}>
      <i className="mn-num" />
      <i className="mn-ph" />
      <i className="mn-ln" />
    </i>
  ));

  if (t.id === "pista") {
    return (
      <span className="mn" data-f="pista" style={estilo} aria-hidden="true">
        <i className="mn-top">
          <i className="mn-marca" />
          <i className="mn-led" />
        </i>
        <i className="mn-nombre" />
        <i className="mn-nombre mn-nombre-2" />
        <i className="mn-rule" />
        <i className="mn-filas">{filas}</i>
      </span>
    );
  }

  if (t.id === "podio") {
    return (
      <span className="mn" data-f="podio" style={estilo} aria-hidden="true">
        <i className="mn-top">
          <i className="mn-marca" />
          <i className="mn-pill" />
        </i>
        <i className="mn-nombre" />
        <i className="mn-nombre mn-nombre-2" />
        <i className="mn-cta" />
        <i className="mn-filas">{filas}</i>
      </span>
    );
  }

  if (t.id === "noche") {
    return (
      <span className="mn" data-f="noche" style={estilo} aria-hidden="true">
        <i className="mn-top">
          <i className="mn-marca" />
          <i className="mn-led" />
        </i>
        <i className="mn-nombre" />
        <i className="mn-grid">{tarjetas}</i>
        <i className="mn-ph mn-ph-ancha" />
      </span>
    );
  }

  if (t.id === "cancha") {
    return (
      <span className="mn" data-f="cancha" style={estilo} aria-hidden="true">
        <i className="mn-top">
          <i className="mn-marca" />
        </i>
        <i className="mn-band">
          <i className="mn-sub" />
          <i className="mn-nombre" />
        </i>
        <i className="mn-stripe" />
        <i className="mn-grid">
          <i className="mn-ph" />
          <i className="mn-ph" />
        </i>
      </span>
    );
  }

  if (t.id === "tablero") {
    return (
      <span className="mn" data-f="tablero" style={estilo} aria-hidden="true">
        <i className="mn-bento-r mn-bento-2">
          <i />
          <i className="mn-ph" />
        </i>
        <i className="mn-bento-r mn-bento-4">
          <i />
          <i />
          <i className="mn-ac" />
          <i />
        </i>
        <i className="mn-bento-r mn-bento-3">
          <i />
          <i />
          <i />
        </i>
      </span>
    );
  }

  if (t.id === "velvet") {
    return (
      <span className="mn" data-f="velvet" style={estilo} aria-hidden="true">
        <i className="mn-top">
          <i className="mn-marca" />
        </i>
        <i className="mn-cinta" />
        <i className="mn-nombre" />
        <i className="mn-cta" />
        <i className="mn-grid">{tarjetas}</i>
      </span>
    );
  }

  if (t.layout === "coverage") {
    return (
      <span className="mn" data-f="coverage" style={estilo} aria-hidden="true">
        <i className="mn-nav">
          <i />
        </i>
        <i className="mn-hero">
          <i className="mn-av" />
          <i className="mn-quien">
            <i className="mn-nombre" />
            <i className="mn-sub" />
          </i>
        </i>
        <i className="mn-grid">{tarjetas}</i>
      </span>
    );
  }

  if (t.layout === "feed") {
    return (
      <span className="mn" data-f="feed" style={estilo} aria-hidden="true">
        <i className="mn-top">
          <i className="mn-marca" />
          <i className="mn-pill" />
        </i>
        <i className="mn-buscar">
          <i />
        </i>
        <i className="mn-feed">
          <i className="mn-ph" />
          <i className="mn-ph" />
        </i>
      </span>
    );
  }

  return (
    <span className="mn" data-f="encontrate" style={estilo} aria-hidden="true">
      <i className="mn-top">
        <i className="mn-marca" />
        <i className="mn-pill" />
      </i>
      <i className="mn-nombre" />
      <i className="mn-sub" />
      <i className="mn-cta" />
      <i className="mn-grid">{tarjetas}</i>
    </span>
  );
}

/** El tamaño de una caja, al día con los cambios de la ventana. */
function useMedida(ref: React.RefObject<HTMLElement | null>) {
  const [medida, setMedida] = useState({ ancho: 0, alto: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => setMedida({ ancho: el.clientWidth, alto: el.clientHeight });
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, [ref]);
  return medida;
}

/**
 * La previa se puede recorrer —scroll para ver los eventos y el pie— pero no
 * navegar: un link llevaría a la página de un evento, que es la pública,
 * dibujada con la plantilla GUARDADA y no con la que se está mirando. Es el
 * mismo origen, así que se le pide al documento que ignore los clicks en
 * links.
 */
function blindar(f: HTMLIFrameElement) {
  try {
    f.contentDocument?.addEventListener(
      "click",
      (e) => {
        if ((e.target as Element | null)?.closest("a")) e.preventDefault();
      },
      true,
    );
  } catch {
    // Otro origen: no debería pasar, es la misma app. Sin blindaje, la previa
    // sigue sirviendo igual.
  }
}

/** La URL de la previa: la plantilla, y los colores con los que se la mira. */
function urlPrevia(id: string, c: Colores) {
  const q = new URLSearchParams({ color: c.color });
  if (c.color2) q.set("color2", c.color2);
  return `/vista-tienda/${id}?${q.toString()}`;
}

/**
 * Una fila de colores: el de fábrica de la plantilla, los presets y uno a
 * medida. El a medida se aplica al soltar, no mientras se arrastra: cada
 * cambio recarga la previa, y un selector que recarga veinte veces por
 * segundo no deja ver nada.
 */
function FilaColor({
  etiqueta,
  valor,
  deFabrica,
  nota,
  onCambiar,
}: {
  etiqueta: string;
  valor: string;
  deFabrica: string;
  nota?: string;
  onCambiar: (c: string) => void;
}) {
  const [libre, setLibre] = useState(valor);
  useEffect(() => setLibre(valor), [valor]);
  const presets = [deFabrica, ...COLORES.filter((c) => !igual(c, deFabrica))];

  return (
    <div className="plm-color">
      <span className="plm-color-t">{etiqueta}</span>
      {presets.map((c, i) => (
        <button
          type="button"
          key={c}
          className="co"
          style={{ background: c }}
          aria-pressed={igual(valor, c)}
          aria-label={i === 0 ? `El de la plantilla, ${c}` : `Color ${c}`}
          title={i === 0 ? "El de la plantilla" : c}
          onClick={() => onCambiar(c)}
        />
      ))}
      <span className="co-libre" title="A medida">
        <Pipette />
        <input
          type="color"
          value={libre}
          aria-label={`${etiqueta} a medida`}
          onChange={(e) => setLibre(e.target.value)}
          onBlur={(e) => onCambiar(e.target.value)}
        />
      </span>
      <span className="plm-color-hex">{valor.toUpperCase()}</span>
      {nota && <span className="plm-color-nota">{nota}</span>}
    </div>
  );
}

function ExplorarPlantillas({
  enUso,
  color,
  color2,
  onElegir,
  onCerrar,
}: {
  enUso: string;
  color: string | null;
  color2: string | null;
  onElegir: (id: string, colores: Colores | null) => Promise<boolean>;
  onCerrar: () => void;
}) {
  const [vista, setVista] = useState(enUso);
  const [telefono, setTelefono] = useState(false);
  // Los colores que el fotógrafo tocó en el diálogo. Null mientras no toque
  // nada: ahí cada plantilla se mira con lo guardado, o con lo suyo de
  // fábrica, y al usarla no se le cambia ningún color.
  const [tocados, setTocados] = useState<Colores | null>(null);
  // Las previas ya pedidas se quedan montadas aunque no se vean: volver a una
  // que ya se miró tiene que ser instantáneo, que es lo que hace posible
  // comparar dos. Se piden recién cuando se eligen, no las diez de entrada.
  const [pedidas, setPedidas] = useState<string[]>([enUso]);
  const [listas, setListas] = useState<string[]>([]);
  const [aplicando, setAplicando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const laEnUso = useRef<HTMLInputElement>(null);

  // Es un diálogo: tapa lo de atrás, se cierra con Escape. Misma mecánica que
  // el resto del panel (:root[data-modal="open"]).
  useEffect(() => {
    document.documentElement.dataset.modal = "open";
    // Con el foco en la elegida, las flechas recorren la lista desde el
    // primer momento: son radios, y eso el navegador ya lo sabe hacer.
    const foco = setTimeout(() => laEnUso.current?.focus(), 60);
    const alTecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    window.addEventListener("keydown", alTecla);
    return () => {
      clearTimeout(foco);
      window.removeEventListener("keydown", alTecla);
      document.documentElement.dataset.modal = "";
    };
  }, [onCerrar]);

  const mirada = getTemplate(vista);
  const esLaDeUso = vista === enUso;
  // Con qué colores se dibuja la que se está mirando.
  const colores: Colores = tocados
    ? { color: tocados.color, color2: mirada.tema?.dosColores ? (tocados.color2 ?? acento2De(mirada)) : null }
    : coloresEfectivos(mirada, color, color2);

  // Cada plantilla con los colores con los que se la mira. Los de las otras
  // previas montadas quedan como estaban: cambiar un color recarga la que se
  // ve y descarta las demás, que se vuelven a pedir si se las visita.
  const [urls, setUrls] = useState<Record<string, string>>({ [enUso]: urlPrevia(enUso, colores) });
  useEffect(() => {
    const url = urlPrevia(vista, colores);
    setUrls((u) => (u[vista] === url ? u : { ...u, [vista]: url }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vista, colores.color, colores.color2]);

  function mirar(id: string) {
    setVista(id);
    setError(null);
    setPedidas((p) => (p.includes(id) ? p : [...p, id]));
  }

  function cambiarColor(c: string) {
    setTocados({ color: c, color2: colores.color2 });
    setPedidas([vista]);
    setListas([]);
  }
  function cambiarColor2(c: string) {
    setTocados({ color: colores.color, color2: c });
    setPedidas([vista]);
    setListas([]);
  }

  async function usar() {
    setAplicando(true);
    setError(null);
    const ok = await onElegir(vista, tocados ? colores : null);
    setAplicando(false);
    if (ok) onCerrar();
    else setError("No se pudo cambiar la plantilla. Probá de nuevo.");
  }

  // La escala sale del ancho real del marco, y el alto del iframe del alto
  // real: así la página llena la previa de arriba a abajo en cualquier
  // ventana. Nunca más grande que al natural: en un monitor ancho, el
  // teléfono sigue midiendo lo que mide un teléfono.
  const area = useRef<HTMLDivElement>(null);
  const visor = useRef<HTMLDivElement>(null);
  const medidaArea = useMedida(area);
  const medidaVisor = useMedida(visor);
  const ancho = telefono ? ANCHO_TELEFONO : ANCHO_ESCRITORIO;
  const escala = medidaArea.ancho ? Math.min(medidaArea.ancho / ancho, 1) : 0.5;
  const alto = medidaVisor.alto ? Math.ceil(medidaVisor.alto / escala) : 900;

  const sinCambios = esLaDeUso && !tocados;

  return (
    <div
      className="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="plm-titulo"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCerrar();
      }}
    >
      <div className="modal-caja plm">
        <div className="modal-h">
          <div>
            <h2 id="plm-titulo">Elegí tu plantilla</h2>
            <div className="sub">
              Cada una, armada con tu página de verdad. No cambia nada hasta que la uses.
            </div>
          </div>
          <button type="button" className="btn btn-ghost btn-icon" onClick={onCerrar} aria-label="Cerrar">
            <X />
          </button>
        </div>

        <div className="plm-cuerpo">
          <div className="plm-lista" role="radiogroup" aria-label="Plantillas">
            {LISTA.map((t) => {
              const c = coloresEfectivos(t, tocados?.color ?? color, tocados?.color2 ?? color2);
              return (
                <label className="plm-op" key={t.id}>
                  <input
                    ref={t.id === enUso ? laEnUso : undefined}
                    type="radio"
                    name="plm"
                    value={t.id}
                    checked={vista === t.id}
                    onChange={() => mirar(t.id)}
                  />
                  <Miniatura t={t} color={c.color} color2={c.color2} />
                  <span className="plm-op-t">
                    <b>
                      {t.name}
                      {t.id === enUso && <em className="plm-uso">En uso</em>}
                    </b>
                    <span>{t.description}</span>
                  </span>
                </label>
              );
            })}
          </div>

          <div className="plm-previa">
            <div className="plm-previa-h">
              <span className="label">Así se vería</span>
              {/* Escritorio o teléfono, con el ícono: dos palabras al lado de
                  la previa compiten con lo que hay que mirar. */}
              <div className="seg seg-ico">
                <button
                  type="button"
                  aria-pressed={!telefono}
                  aria-label="Escritorio"
                  title="Escritorio"
                  onClick={() => setTelefono(false)}
                >
                  <Monitor />
                </button>
                <button
                  type="button"
                  aria-pressed={telefono}
                  aria-label="Teléfono"
                  title="Teléfono"
                  onClick={() => setTelefono(true)}
                >
                  <Smartphone />
                </button>
              </div>
            </div>

            {/* Los colores, arriba de la previa: se cambian mirando cómo
                quedan. El secundario sólo existe en las plantillas de dos. */}
            <div className="plm-colores">
              <FilaColor
                etiqueta={mirada.tema?.dosColores ? "Color principal" : "Color"}
                valor={colores.color}
                deFabrica={acentoDe(mirada)}
                onCambiar={cambiarColor}
              />
              {mirada.tema?.dosColores && colores.color2 && (
                <FilaColor
                  etiqueta="Color secundario"
                  valor={colores.color2}
                  deFabrica={acento2De(mirada) ?? colores.color2}
                  nota="El principal va en la banda y el carrito; el secundario, en lo que se compra."
                  onCambiar={cambiarColor2}
                />
              )}
            </div>

            <div className="plm-marco">
              <div className="plm-area" ref={area}>
                <div className="plm-pantalla" style={{ width: ancho * escala }}>
                  <div className="crome">
                    <i />
                    <i />
                    <i />
                    <span className="url">Tu página con {mirada.name}</span>
                  </div>
                  <div className="plm-visor" ref={visor}>
                    {pedidas.map((id) => (
                      <iframe
                        key={id}
                        src={urls[id] ?? urlPrevia(id, colores)}
                        title={`Tu página con la plantilla ${getTemplate(id).name}`}
                        width={ancho}
                        height={alto}
                        style={{
                          transform: `scale(${escala})`,
                          display: id === vista ? undefined : "none",
                        }}
                        onLoad={(e) => {
                          blindar(e.currentTarget);
                          setListas((l) => (l.includes(id) ? l : [...l, id]));
                        }}
                      />
                    ))}
                    {!listas.includes(vista) && (
                      <div className="plm-cargando">
                        <span className="sk" />
                        Armando la previa…
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-f">
          <span className="plm-f-t" data-err={error ? "1" : undefined}>
            {error ??
              (sinCambios
                ? "Es la que usás ahora."
                : "Se aplica a tu página y a todos tus eventos. Los colores también.")}
          </span>
          <button type="button" className="btn btn-ghost" onClick={onCerrar}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-pri"
            onClick={() => void usar()}
            disabled={sinCambios || aplicando}
          >
            {aplicando ? "Aplicando…" : esLaDeUso ? "Guardar colores" : `Usar ${mirada.name}`}
          </button>
        </div>
      </div>
    </div>
  );
}
