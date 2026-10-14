"use client";

import { Check, LayoutTemplate, X } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";

import { previsualizarPlantillaAction } from "./actions";

/**
 * La plantilla de la tienda: la elegida, grande, y un modal para explorar.
 *
 * Antes eran tres miniaturas dibujadas en CSS —una barra y seis cuadrados
 * grises— que no decían nada de cómo se ve la galería. Ahora el bloque
 * muestra la tienda real, en un teléfono, con la plantilla que está en uso;
 * y «Explorar plantillas» abre un modal con la lista a la izquierda y la
 * misma tienda a la derecha, dibujada con la plantilla que se está mirando,
 * SIN guardarla: elegir es apretar «Usar esta plantilla».
 *
 * La previa del modal se logra con una cookie (ver server/plantilla-previa):
 * la tienda, cuando la mira su dueña con esa cookie, se dibuja con la
 * plantilla que dice la cookie. Para cualquier otro no cambia nada.
 *
 * Se muestra un evento con fotos y no el perfil: la plantilla se nota en la
 * galería, que es donde el comprador pasa el tiempo. Sin eventos, el perfil.
 */

export const PLANTILLAS = [
  {
    id: "encontrate",
    nombre: "encontrate",
    detalle: "Clara y minimalista: la foto es lo único con color.",
    fondo: "#FFFFFF",
    tinta: "#14120F",
  },
  {
    id: "dark",
    nombre: "Oscuro",
    detalle: "Cálida y profunda: hace resaltar tus fotos.",
    fondo: "#131211",
    tinta: "#F4F3EF",
  },
  {
    id: "feed",
    nombre: "Editorial",
    detalle: "Búsqueda al frente y fotos en un feed vertical, pensada para el celular.",
    fondo: "#F4F2ED",
    tinta: "#1A1815",
  },
] as const;

export type PlantillaId = (typeof PLANTILLAS)[number]["id"];

const ANCHO = 390;
const ALTO = 844;

/**
 * La tienda adentro de un teléfono. La página se dibuja a 390 px de ancho
 * —el teléfono de verdad— y se reduce a lo que mida el marco; la escala sale
 * del ancho real, así no se desalinea cuando la ventana cambia.
 */
function Fono({ src, version, cargando = false }: { src: string; version: number; cargando?: boolean }) {
  const marco = useRef<HTMLDivElement>(null);
  const [escala, setEscala] = useState(0.5);

  useEffect(() => {
    const el = marco.current;
    if (!el) return;
    const medir = () => setEscala(el.clientWidth / ANCHO);
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div className="fono" ref={marco} style={{ height: ALTO * escala }} data-cargando={cargando ? "1" : undefined}>
      <iframe
        key={`${src}-${version}`}
        src={src}
        title="Previa de tu tienda"
        width={ANCHO}
        height={ALTO}
        style={{ transform: `scale(${escala})` }}
        loading="lazy"
      />
    </div>
  );
}

export function Plantillas({
  actual,
  slug,
  eventoPrevia,
  version,
  guardando,
  onElegir,
}: {
  /** La plantilla guardada. */
  actual: string;
  slug: string;
  /** El evento con el que se dibuja la previa; null → el perfil. */
  eventoPrevia: string | null;
  /** Sube cuando algo se guardó: la previa del bloque se vuelve a cargar. */
  version: number;
  guardando: boolean;
  onElegir: (id: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [mirando, setMirando] = useState(actual);
  const [versionModal, setVersionModal] = useState(0);
  const [cargandoPrevia, empezar] = useTransition();

  const ruta = slug ? (eventoPrevia ? `/${slug}/${eventoPrevia}` : `/${slug}`) : null;
  const info = PLANTILLAS.find((p) => p.id === actual) ?? PLANTILLAS[0];

  useEffect(() => {
    if (!abierto) return;
    document.documentElement.dataset.modal = "open";
    const alTecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrar();
    };
    window.addEventListener("keydown", alTecla);
    return () => {
      window.removeEventListener("keydown", alTecla);
      document.documentElement.dataset.modal = "";
    };
    // cerrar cambia con cada render; alcanza con el estado de abierto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  function abrir() {
    setMirando(actual);
    setVersionModal((v) => v + 1);
    setAbierto(true);
  }

  function cerrar() {
    setAbierto(false);
    // Si quedó una previa prendida, se apaga: si no, la página propia
    // seguiría disfrazada diez minutos.
    if (mirando !== actual) void previsualizarPlantillaAction(null);
  }

  function mirar(id: string) {
    if (id === mirando) return;
    setMirando(id);
    empezar(async () => {
      // La cookie primero, la recarga después: al revés, el iframe se
      // dibuja con la plantilla vieja.
      await previsualizarPlantillaAction(id === actual ? null : id);
      setVersionModal((v) => v + 1);
    });
  }

  function usar() {
    setAbierto(false);
    onElegir(mirando);
  }

  return (
    <>
      <section className="card blq">
        <h2>Plantilla</h2>
        <p className="ayuda">Cómo se ve tu galería. Se aplica a todos tus eventos.</p>
        <div className="blq-b pl-actual">
          {ruta ? (
            <Fono src={ruta} version={version} />
          ) : (
            <div className="fono fono-vacio">Elegí una dirección para ver tu tienda.</div>
          )}
          <div className="pl-actual-t">
            <span className="label">En uso</span>
            <b>{info.nombre}</b>
            <p>{info.detalle}</p>
            <button type="button" className="btn btn-ghost btn-sm" onClick={abrir} disabled={guardando}>
              <LayoutTemplate /> Explorar plantillas
            </button>
          </div>
        </div>
      </section>

      {abierto && (
        <div
          className="modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="plantillas-titulo"
          onClick={(e) => {
            if (e.target === e.currentTarget) cerrar();
          }}
        >
          <div className="modal-caja ancha">
            <div className="modal-h">
              <div>
                <h2 id="plantillas-titulo">Elegir plantilla</h2>
                <div className="sub">
                  La previa es tu tienda de verdad, con la plantilla que estás mirando. Nada se guarda
                  hasta que la uses.
                </div>
              </div>
              <button type="button" className="btn btn-ghost btn-icon" onClick={cerrar} aria-label="Cerrar">
                <X />
              </button>
            </div>

            <div className="modal-b">
              <div className="plm">
                <div className="plm-ops" role="radiogroup" aria-label="Plantillas">
                  {PLANTILLAS.map((p) => (
                    <button
                      type="button"
                      key={p.id}
                      className="plm-op"
                      role="radio"
                      aria-checked={mirando === p.id}
                      onClick={() => mirar(p.id)}
                    >
                      <span className="plm-sw" style={{ background: p.fondo, color: p.tinta }}>
                        <i />
                        <i />
                        <i />
                      </span>
                      <span className="plm-op-t">
                        <b>
                          {p.nombre}
                          {p.id === actual && <span className="plm-enuso">en uso</span>}
                        </b>
                        <span>{p.detalle}</span>
                      </span>
                      <span className="plm-tick">
                        <Check />
                      </span>
                    </button>
                  ))}
                  <p className="plm-nota">
                    {eventoPrevia
                      ? "La previa es tu evento más reciente con fotos, tal cual lo ve un comprador en el celular. Podés desplazarla para ver la grilla."
                      : "Cuando tengas un evento publicado con fotos, la previa lo va a mostrar; mientras tanto, tu perfil."}
                  </p>
                </div>
                {ruta ? (
                  <Fono src={ruta} version={versionModal} cargando={cargandoPrevia} />
                ) : (
                  <div className="fono fono-vacio">Elegí una dirección para ver tu tienda.</div>
                )}
              </div>
            </div>

            <div className="modal-f">
              <button type="button" className="btn btn-ghost" onClick={cerrar}>
                Cancelar
              </button>
              <button type="button" className="btn btn-pri" onClick={usar} disabled={mirando === actual || cargandoPrevia}>
                {mirando === actual ? "Es la que tenés" : "Usar esta plantilla"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
