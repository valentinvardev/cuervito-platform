"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  CircleAlert,
  CircleCheck,
  Clock,
  Copy,
  Crown,
  ExternalLink,
  Image as ImagenIcono,
  Info,
  ListFilter,
  ScanFace,
  ScanSearch,
  ShoppingBag,
  Tag,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { Desplegable } from "../../_components/desplegable";
import { Fecha } from "../../_components/fecha";
import { iniciales as siglas } from "../../_components/formato";
import {
  borrarEventoAction,
  guardarDatosAction,
  guardarPrecioAction,
  publicarAction,
} from "./acciones";
import { Descuentos } from "./_descuentos";
import { Invitar } from "./_invitar";
import { Soltador } from "./_soltador";
import { Visor } from "./_visor";

type Foto = {
  id: string;
  url: string | null;
  bib: string | null;
  vendida: boolean;
  ventas: number;
  caras: number;
  reconocida: boolean;
};
type Colaborador = { nombre: string; email: string; estado: string; fotos: number; cobra: boolean };

const POR_PAG = 20;

/** Tope de la portada. El mismo que acepta el endpoint. */
const MAX_PORTADA = 8 * 1024 * 1024;

// Las mismas que ofrece el alta: con dos listas distintas, el mismo deporte
// queda escrito distinto según por dónde se cargó.
const DISCIPLINAS = ["Running", "Ciclismo", "Trail", "Duatlón", "Triatlón", "MTB", "Otra"];

const FILTROS = [
  { k: "todas", txt: "Todas" },
  { k: "sinrec", txt: "Sin reconocer" },
  { k: "sindor", txt: "Sin dorsal" },
  { k: "vend", txt: "Vendidas" },
] as const;

/**
 * Pantalla del evento.
 *
 * Las tres tarjetas-solapa de la versión actual (Galería, Monetización, Info)
 * ocupaban una franja de alto permanente sólo para elegir pestaña. En una
 * pantalla donde el fotógrafo viene a mirar sus fotos, ese espacio es de las
 * fotos: acá las solapas son una barra compacta.
 *
 * La grilla se pagina. Volcar miles de celdas de una hace que el navegador arme
 * miles de nodos y el scroll se ponga pesado justo donde se está trabajando.
 */
export function Pantalla({
  evento,
  fotos,
  colaboradores,
  publico,
  yo,
  fotosDelDueno,
  simulado = false,
}: {
  evento: {
    id: string;
    nombre: string;
    fecha: string | null;
    lugar: string | null;
    disciplina: string | null;
    /** Para el selector de fecha, que trabaja en aaaa-mm-dd y no en "14 de agosto". */
    fechaISO: string | null;
    portada: string | null;
    publicado: boolean;
    precio: number;
    comision: number;
    reconocimiento: boolean;
    leeDorsales: boolean;
    /** Tope por foto, para avisar antes de mandar y no después. */
    maxFoto: number;
    descripcion: string | null;
    total: number;
    reconocidas: number;
    conDorsal: number;
    ventas: number;
    recaudado: string;
  };
  fotos: Foto[];
  colaboradores: Colaborador[];
  publico: string | null;
  yo: string;
  fotosDelDueno: number;
  /**
   * Modo demo. Lo usa /demo/subida para grabar esta misma pantalla subiendo
   * un álbum sin tocar la red ni crear fotos de verdad.
   */
  simulado?: boolean;
}) {
  const sinCobrar = colaboradores.filter((c) => c.estado !== "PENDING" && !c.cobra);
  const [publicando, empezarPub] = useTransition();

  // La portada se podía poner al crear el evento y después nunca más. El que
  // se equivocaba de foto —o la subía antes de tener una buena— se quedaba con
  // esa para siempre, y es lo primero que ve el atleta en la página de venta.
  const portadaRef = useRef<HTMLInputElement>(null);
  const [subiendoPortada, setSubiendoPortada] = useState(false);
  const [errorPortada, setErrorPortada] = useState<string | null>(null);

  async function cambiarPortada(archivo: File) {
    setErrorPortada(null);
    // Se filtra acá además del servidor: subir ocho megas para que los
    // rechacen del otro lado es esperar al pedo con datos móviles.
    if (!["image/jpeg", "image/png", "image/webp"].includes(archivo.type)) {
      setErrorPortada("Tiene que ser JPG, PNG o WebP.");
      return;
    }
    if (archivo.size > MAX_PORTADA) {
      setErrorPortada("La portada no puede pesar más de 8 MB.");
      return;
    }
    setSubiendoPortada(true);
    try {
      const cuerpo = new FormData();
      cuerpo.append("cover", archivo);
      const r = await fetch(`/api/dashboard/events/${evento.id}/cover`, {
        method: "POST",
        body: cuerpo,
      });
      if (!r.ok) {
        const d = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(d.error ?? "No se pudo subir la portada.");
      }
      router.refresh();
    } catch (e) {
      setErrorPortada(e instanceof Error ? e.message : "No se pudo subir la portada.");
    } finally {
      setSubiendoPortada(false);
    }
  }

  async function quitarPortada() {
    setErrorPortada(null);
    setSubiendoPortada(true);
    try {
      const r = await fetch(`/api/dashboard/events/${evento.id}/cover`, { method: "DELETE" });
      if (!r.ok) throw new Error("No se pudo quitar la portada.");
      router.refresh();
    } catch (e) {
      setErrorPortada(e instanceof Error ? e.message : "No se pudo quitar la portada.");
    } finally {
      setSubiendoPortada(false);
    }
  }
  const [avisoPub, setAvisoPub] = useState<string | null>(null);


  const [solapa, setSolapa] = useState<"fotos" | "precio" | "equipo" | "info">("fotos");
  const [filtro, setFiltro] = useState<string>("todas");
  const [buscado, setBuscado] = useState("");
  const [pagina, setPagina] = useState(1);
  const [abierto, setAbierto] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const router = useRouter();
  const [elegidas, setElegidas] = useState<Set<string>>(new Set());
  const [borrando, setBorrando] = useState(false);
  const [errorLote, setErrorLote] = useState<string | null>(null);

  // Índice dentro de la página que se está viendo en grande, o null.
  const [viendo, setViendo] = useState<number | null>(null);

  // El modo selección se prende tocando un tilde y se apaga cuando no queda
  // ninguna elegida. No es un estado aparte: si hubiera un interruptor propio,
  // se podría quedar prendido sin nada seleccionado y las fotos dejarían de
  // abrirse sin motivo visible.
  const modoSel = elegidas.size > 0;

  function alternar(id: string) {
    setElegidas((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  }

  /** Borrar fotos. La usan la barra de selección y el visor. */
  async function borrarFotos(ids: string[]) {
    if (ids.length === 0) return;
    setBorrando(true);
    setErrorLote(null);
    try {
      // De a 500, que es el tope del endpoint.
      for (let i = 0; i < ids.length; i += 500) {
        const r = await fetch(`/api/dashboard/events/${evento.id}/photos/bulk-delete`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ photoIds: ids.slice(i, i + 500) }),
        });
        if (!r.ok) {
          const d = (await r.json().catch(() => ({}))) as { error?: string };
          throw new Error(d.error ?? "No se pudieron borrar");
        }
      }
      setElegidas(new Set());
      router.refresh();
    } catch (e) {
      setErrorLote(e instanceof Error ? e.message : "No se pudieron borrar");
    } finally {
      setBorrando(false);
    }
  }

  // La barra flotante y el recuadro de cada foto cuelgan de :root[data-sel] en
  // el CSS del laboratorio, que es lo que hace que la barra entre deslizándose
  // desde abajo en vez de aparecer de golpe.
  useEffect(() => {
    document.documentElement.dataset.sel = elegidas.size > 0 ? "on" : "";
    return () => {
      document.documentElement.dataset.sel = "";
    };
  }, [elegidas]);

  // Escape cancela la selección, que es lo primero que prueba cualquiera.
  useEffect(() => {
    if (elegidas.size === 0) return;
    const alTecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setElegidas(new Set());
    };
    window.addEventListener("keydown", alTecla);
    return () => window.removeEventListener("keydown", alTecla);
  }, [elegidas.size]);

  // Al cambiar de solapa o de filtro la selección se cancela. Si no, quedaba la
  // barra flotante diciendo "12 seleccionadas" sobre una grilla que ya
  // muestra otras fotos, y Eliminar borraba doce que no estaban a la vista.
  useEffect(() => {
    setElegidas(new Set());
    // Y se cierra el visor: si no, queda mirando una foto que ya no está en la
    // lista, y las flechas se mueven sobre otro conjunto. La página va como
    // `pagina` y no como `pag`, que se calcula más abajo.
    setViendo(null);
  }, [solapa, filtro, buscado, pagina]);

  const cuentas = useMemo(() => {
    const c = { todas: fotos.length, sinrec: 0, sindor: 0, vend: 0 };
    for (const f of fotos) {
      if (!f.reconocida) c.sinrec++;
      else if (!f.bib) c.sindor++;
      if (f.vendida) c.vend++;
    }
    return c;
  }, [fotos]);

  const filtradas = useMemo(
    () =>
      fotos.filter((f) => {
        if (filtro === "sinrec" && f.reconocida) return false;
        if (filtro === "sindor" && (!f.reconocida || f.bib)) return false;
        if (filtro === "vend" && !f.vendida) return false;
        // Por prefijo y no exacto: se tipea "12" y aparecen 1247 y 1288
        // mientras se sigue escribiendo.
        if (buscado && !(f.bib ?? "").split(",").some((b) => b.trim().startsWith(buscado))) return false;
        return true;
      }),
    [fotos, filtro, buscado],
  );

  const paginas = Math.max(1, Math.ceil(filtradas.length / POR_PAG));
  const pag = Math.min(pagina, paginas);
  const trozo = filtradas.slice((pag - 1) * POR_PAG, pag * POR_PAG);
  const faltan = evento.total - evento.reconocidas;

  return (
    <main className="canvas">
      <div className="canvas-in">
        <Link href="/dashboard/eventos" className="btn btn-ghost btn-sm" style={{ justifySelf: "start" }}>
          <ArrowLeft /> Eventos
        </Link>

        <section
          className="banda"
          style={
            evento.portada ? { backgroundImage: `url(${evento.portada})`, backgroundSize: "cover" } : undefined
          }
        >
          <div className="banda-in">
            <div>
              <div className="banda-meta">
                {evento.publicado ? (
                  <span className="pill live">
                    <i /> Publicado
                  </span>
                ) : (
                  <span className="pill draft">
                    <i /> Borrador
                  </span>
                )}
                <span className="dato">
                  {evento.fecha ?? "Sin fecha"}
                  {evento.lugar && (
                    <>
                      <i />
                      {evento.lugar}
                    </>
                  )}
                </span>
              </div>
              <h1>{evento.nombre}</h1>
            </div>
            {/* Publicar es la acción de la pantalla, así que va en la banda y
                no adentro de una solapa. Antes acá había un link que se iba al
                panel viejo. */}
            <div className="banda-acc">
              {(avisoPub ?? errorPortada) && (
                <span className="btn btn-vidrio">{avisoPub ?? errorPortada}</span>
              )}

              {/* Cambiar la portada. Va acá, sobre la propia portada, y no
                  enterrado en la solapa de Info: es el único lugar donde se
                  ve el resultado mientras se decide. */}
              <input
                ref={portadaRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void cambiarPortada(f);
                  // Se limpia para que elegir el mismo archivo dos veces
                  // vuelva a disparar el change.
                  e.target.value = "";
                }}
              />
              <button
                className="btn btn-vidrio"
                type="button"
                disabled={subiendoPortada}
                onClick={() => portadaRef.current?.click()}
                data-tip="JPG, PNG o WebP, hasta 8 MB"
              >
                <ImagenIcono />
                {subiendoPortada
                  ? "Subiendo"
                  : evento.portada
                    ? "Cambiar portada"
                    : "Poner portada"}
              </button>

              {evento.portada && !subiendoPortada && (
                <button
                  className="btn btn-vidrio"
                  type="button"
                  onClick={() => void quitarPortada()}
                  data-tip="Vuelve al fondo sin foto"
                  aria-label="Quitar portada"
                >
                  <X />
                </button>
              )}
              <button
                className="btn btn-vidrio"
                type="button"
                disabled={publicando}
                onClick={() =>
                  empezarPub(async () => {
                    const r = await publicarAction(evento.id);
                    if (r.error) {
                      setAvisoPub(r.error);
                      setTimeout(() => setAvisoPub(null), 3000);
                    }
                  })
                }
              >
                {publicando
                  ? "Un momento"
                  : evento.publicado
                    ? "Despublicar"
                    : "Publicar evento"}
              </button>
            </div>
          </div>
        </section>

        {/* Publicar sin repartir el link no vende nada, así que el paso
            siguiente a publicar va a la vista y no enterrado. */}
        {publico && (
          <div className="link-pub">
            <ExternalLink />
            <span className="url">encontrate.app{publico}</span>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                void navigator.clipboard.writeText(`${location.origin}${publico}`);
                setCopiado(true);
                setTimeout(() => setCopiado(false), 1800);
              }}
            >
              <Copy /> {copiado ? "Copiado" : "Copiar"}
            </button>
            <a href={publico} target="_blank" rel="noopener" className="btn btn-ghost btn-sm">
              <ExternalLink /> Ver
            </a>
          </div>
        )}

        <section className="cifras">
          <div className="card cifra">
            <div className="c-top">
              <span>Fotos</span>
              <ImagenIcono />
            </div>
            <b className="tnum">{evento.total.toLocaleString("es-AR")}</b>
            <div className="nota-c">En este evento</div>
          </div>

          <div className="card cifra">
            <div className="c-top">
              <span>Buscables</span>
              <ScanSearch />
            </div>
            <b className="tnum">{evento.reconocidas.toLocaleString("es-AR")}</b>
            <div className={`nota-c${faltan > 0 ? " alerta" : ""}`}>
              {faltan > 0 ? `${faltan.toLocaleString("es-AR")} todavía procesando` : "Todas listas"}
            </div>
          </div>

          <div className="card cifra">
            <div className="c-top">
              <span>Ventas</span>
              <ShoppingBag />
            </div>
            <b className="tnum">{evento.ventas.toLocaleString("es-AR")}</b>
            <div className="nota-c">Compras de este evento</div>
          </div>

          <div className="card cifra">
            <div className="c-top">
              <span>Recaudado</span>
              <Tag />
            </div>
            <b className="tnum">{evento.recaudado}</b>
            <div className="nota-c">Tu parte, ya cobrada</div>
          </div>
        </section>

        {/* Subir y reconocer tardan muy distinto. Mostrar una sola barra hace
            que después de subir parezca que el sistema se colgó, cuando en
            realidad está en la parte lenta. */}
        {faltan > 0 && (
          <section className="card proc">
            <div className="etapa lenta">
              <div className="etapa-t">
                <b>
                  <span className="et-i">
                    <ScanFace />
                  </span>{" "}
                  Reconociendo caras y dorsales
                </b>
                <span className="cuenta">
                  {evento.reconocidas.toLocaleString("es-AR")} de {evento.total.toLocaleString("es-AR")}
                </span>
              </div>
              <div className="pista-b">
                <i style={{ width: `${(evento.reconocidas / Math.max(1, evento.total)) * 100}%` }} />
              </div>
              <div className="detalle">Podés cerrar esta pantalla, sigue solo.</div>
            </div>
          </section>
        )}

        <div className="solapas" role="tablist">
          <button
            className="solapa"
            role="tab"
            aria-selected={solapa === "fotos"}
            onClick={() => setSolapa("fotos")}
          >
            <ImagenIcono /> Fotos <span className="n">{evento.total.toLocaleString("es-AR")}</span>
          </button>
          <button
            className="solapa"
            role="tab"
            aria-selected={solapa === "precio"}
            onClick={() => setSolapa("precio")}
          >
            <Tag /> Precio
          </button>
          <button
            className="solapa"
            role="tab"
            aria-selected={solapa === "equipo"}
            onClick={() => setSolapa("equipo")}
          >
            <Users /> Equipo <span className="n">{colaboradores.length + 1}</span>
          </button>
          <button
            className="solapa"
            role="tab"
            aria-selected={solapa === "info"}
            onClick={() => setSolapa("info")}
          >
            <Info /> Info
          </button>
        </div>

        {solapa === "fotos" && (
          <section className="panel-s" data-activo="1">
            <Soltador eventId={evento.id} maxBytes={evento.maxFoto} simulado={simulado} />

            <div className="barra">
              <div style={{ display: "flex", gap: "var(--s-2)", alignItems: "center", flexWrap: "wrap" }}>
                {/* Los cuatro estados plegados: en fila comían todo el ancho y
                    crecen con cada estado nuevo. */}
                <div className="dd" data-abierto={abierto ? "1" : ""}>
                  <button
                    type="button"
                    className="dd-t"
                    aria-expanded={abierto}
                    onClick={() => setAbierto((v) => !v)}
                  >
                    <ListFilter />
                    <span className="dd-v">{FILTROS.find((f) => f.k === filtro)?.txt}</span>
                  </button>
                  <div className="dd-m" role="listbox">
                    {FILTROS.map((f) => (
                      <button
                        type="button"
                        key={f.k}
                        className="dd-o"
                        role="option"
                        aria-selected={filtro === f.k}
                        onClick={() => {
                          setFiltro(f.k);
                          setPagina(1);
                          setAbierto(false);
                        }}
                      >
                        {f.txt} <b className="dd-n">{cuentas[f.k].toLocaleString("es-AR")}</b>
                      </button>
                    ))}
                  </div>
                </div>

                {/* El numeral es prefijo fijo del campo: así dice qué espera
                    sin necesitar rótulo, y nadie lo escribe de más. */}
                <div className="pegado chico" style={{ width: 150 }}>
                  <span className="fijo">#</span>
                  <input
                    className="inp tnum"
                    inputMode="numeric"
                    placeholder="Dorsal"
                    value={buscado}
                    onChange={(e) => {
                      setBuscado(e.target.value.replace(/[^0-9]/g, "").slice(0, 5));
                      setPagina(1);
                    }}
                  />
                </div>
              </div>

              {/* "Todas" es LA PÁGINA, no las 2.162 del evento. Decir que
                  seleccionaste dos mil fotos y después borrar veinte es una
                  mentira, y al revés —creer que seleccionaste todas y borrar
                  las dos mil— es peor. */}
              <button
                className="btn btn-ghost btn-sm"
                type="button"
                onClick={() => {
                  const enPagina = trozo.map((f) => f.id);
                  const faltan = enPagina.some((id) => !elegidas.has(id));
                  setElegidas((prev) => {
                    const s = new Set(prev);
                    for (const id of enPagina) {
                      if (faltan) s.add(id);
                      else s.delete(id);
                    }
                    return s;
                  });
                }}
              >
                {trozo.every((f) => elegidas.has(f.id)) && trozo.length > 0
                  ? "Quitar selección"
                  : "Seleccionar todas"}
              </button>
            </div>

            {trozo.length > 0 ? (
              <>
                <div className="fg">
                  {trozo.map((f, i) => {
                    const elegida = elegidas.has(f.id);
                    return (
                      <div
                        className={`ft ${elegida ? "sel" : ""}`}
                        key={f.id}
                        role="button"
                        tabIndex={0}
                        aria-pressed={modoSel ? elegida : undefined}
                        // Tocar la foto la abre; sólo selecciona si YA se entró
                        // al modo selección tocando un tilde. Mirar es lo que se
                        // hace todo el tiempo acá y seleccionar es ocasional:
                        // el gesto barato tiene que hacer lo frecuente.
                        onClick={() => (modoSel ? alternar(f.id) : setViendo(i))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            if (modoSel) alternar(f.id);
                            else setViendo(i);
                          }
                        }}
                      >
                        <div
                          className="ft-i"
                          style={
                            f.url
                              ? {
                                  backgroundImage: `url(${f.url})`,
                                  backgroundSize: "cover",
                                  backgroundPosition: "center",
                                }
                              : undefined
                          }
                        />
                        <div className="ft-v" />
                        {/* El tilde es la puerta de entrada al modo selección:
                            tocarlo elige esa foto y a partir de ahí cualquier
                            toque sobre una foto elige, sin abrir nada. */}
                        <span
                          className="ft-c"
                          role="checkbox"
                          aria-checked={elegida}
                          aria-label={elegida ? "Quitar de la selección" : "Seleccionar"}
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            alternar(f.id);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              e.stopPropagation();
                              alternar(f.id);
                            }
                          }}
                        >
                          <Check />
                        </span>
                        {!f.reconocida && (
                          <span className="ft-f warn" title="Todavía procesando">
                            <ScanFace />
                          </span>
                        )}
                        {f.vendida && (
                          <span className="ft-f sold" title="Vendida">
                            <Check />
                          </span>
                        )}
                        <div className="ft-d">
                          {f.bib && (
                            <span className="bib">
                              <i>#</i>
                              {f.bib.split(",")[0]}
                            </span>
                          )}
                          {/* Aparece al pasar el mouse: cuántas caras se
                              indexaron y, si se vendió, cuántas veces. Las
                              caras son lo que decide si esa foto va a aparecer
                              en una búsqueda por selfie, así que un cero acá
                              explica por qué una foto no la encuentra nadie. */}
                          <span className="ft-meta">
                            <ScanFace /> {f.caras}
                            {f.ventas > 0 && (
                              <>
                                {" "}
                                <ShoppingBag /> {f.ventas}
                              </>
                            )}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pag">
                  <span className="pag-info">
                    {((pag - 1) * POR_PAG + 1).toLocaleString("es-AR")}–
                    {((pag - 1) * POR_PAG + trozo.length).toLocaleString("es-AR")} de{" "}
                    {filtradas.length.toLocaleString("es-AR")}
                  </span>
                  <div className="pag-btns">
                    {/* Deshabilitados en los extremos y no escondidos: si
                        desaparecen, los demás se corren bajo el dedo. */}
                    <button className="pag-b" disabled={pag === 1} onClick={() => setPagina(pag - 1)}>
                      ‹
                    </button>
                    <span className="pag-info tnum">
                      {pag} / {paginas}
                    </span>
                    <button className="pag-b" disabled={pag === paginas} onClick={() => setPagina(pag + 1)}>
                      ›
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="empty">
                <div className="empty-i">
                  <ScanSearch />
                </div>
                {/* Un evento sin NINGUNA foto no es lo mismo que un filtro sin
                    resultados. Recién creado mostraba “Probá con otro filtro”
                    estando en Todas, que no lleva a ninguna parte: lo que hay
                    que hacer ahí es subir fotos, y el soltador está arriba. */}
                <h3>
                  {fotos.length === 0
                    ? "Todavía no hay fotos en este evento"
                    : buscado
                      ? "Ninguna foto con ese dorsal"
                      : "No hay fotos con ese filtro"}
                </h3>
                <p>
                  {fotos.length === 0
                    ? "Subilas desde el recuadro de arriba. Podés soltar la carpeta entera del evento."
                    : buscado
                      ? "Puede que el dorsal no se haya leído bien, o que esa foto todavía esté procesando."
                      : "Probá con otro filtro."}
                </p>
              </div>
            )}
            {viendo !== null && (
              <Visor
                fotos={trozo}
                indice={viendo}
                eventId={evento.id}
                alCerrar={() => setViendo(null)}
                alIr={setViendo}
                alBorrar={(id) => void borrarFotos([id])}
              />
            )}

            {/* Flotante y abajo, no arriba de la grilla: la selección se hace
                mirando las fotos, y una barra pegada al encabezado obliga a
                subir la vista para actuar. El CSS la desliza según data-sel. */}
            <div className="lote">
              <span className="lote-n">
                {elegidas.size} {elegidas.size === 1 ? "seleccionada" : "seleccionadas"}
              </span>
              {errorLote && <span style={{ fontSize: 12.5 }}>{errorLote}</span>}
              {/* Del laboratorio faltan acá "Reconocer" y "Descargar". No las
                  puse porque no existe endpoint para ninguna de las dos: el
                  reconocimiento no se puede volver a disparar a mano, y la
                  descarga es de a una foto, así que en lote sería abrir treinta
                  pestañas que el navegador bloquea. Van cuando exista con qué. */}
              <button
                className="btn btn-ghost btn-sm peligro"
                type="button"
                disabled={borrando}
                onClick={() => void borrarFotos(Array.from(elegidas))}
              >
                <Trash2 /> {borrando ? "Borrando" : `Eliminar ${elegidas.size}`}
              </button>
              <button
                className="btn btn-ghost btn-icon lote-x"
                type="button"
                onClick={() => setElegidas(new Set())}
                aria-label="Cancelar selección"
              >
                <X />
              </button>
            </div>
          </section>
        )}

        {solapa === "precio" && (
          <section className="panel-s" data-activo="1">
            <Precio eventoId={evento.id} inicial={evento.precio} comision={evento.comision} />

            <Descuentos eventId={evento.id} precio={evento.precio} />

            {/* En el laboratorio esto eran tres interruptores: por cara, por
                dorsal y marca de agua. No los porté porque no hay ninguna
                columna atrás: el reconocimiento corre igual para todos los
                eventos y la marca de agua también. Un interruptor que se mueve
                y no cambia nada es peor que no tenerlo, porque el fotógrafo lo
                apaga creyendo que apagó algo.

                Lo que sí se puede decir es qué encontró el reconocimiento en
                ESTE evento, que es la pregunta de abajo: si mis fotos se van a
                poder encontrar. */}
            <div className="card blq">
              <h2>Cómo se buscan tus fotos</h2>
              <p className="ayuda">
                Se hace solo cuando subís. Hoy no es algo que se configure por evento.
              </p>
              <div className="blq-b" style={{ gap: 0 }}>
                <div className="aj">
                  <div className="aj-t">
                    <b>Por cara</b>
                    <span>El atleta se saca una selfie y aparecen sus fotos</span>
                  </div>
                  <span className="pill live">
                    <i /> {evento.reconocidas.toLocaleString("es-AR")} de{" "}
                    {evento.total.toLocaleString("es-AR")}
                  </span>
                </div>
                <div className="aj">
                  <div className="aj-t">
                    <b>Por dorsal</b>
                    <span>
                      {evento.leeDorsales
                        ? "Leemos el número de la camiseta o del dorsal"
                        : "Apagado: en las primeras fotos no apareció ningún dorsal"}
                    </span>
                  </div>
                  {evento.leeDorsales ? (
                    <span className="pill live">
                      <i /> {evento.conDorsal.toLocaleString("es-AR")} de{" "}
                      {evento.total.toLocaleString("es-AR")}
                    </span>
                  ) : (
                    <span className="pill draft">
                      <i /> Apagado
                    </span>
                  )}
                </div>
              </div>
              {/* Dicho acá y no en un log del servidor: el fotógrafo ve el
                  contador de dorsales quieto y sin esto no tiene forma de saber
                  que fue una decisión y no una falla. */}
              {!evento.leeDorsales && (
                <div className="porque">
                  <Info />
                  <span>
                    La lectura de dorsales se apagó sola: en las primeras diez fotos procesadas no
                    apareció ningún número. Pasa en trail, ciclismo o entrenamientos, donde nadie
                    lleva dorsal. La búsqueda por cara sigue funcionando igual.
                  </span>
                </div>
              )}

              {evento.total > 0 && evento.reconocidas < evento.total && (
                <div className="porque">
                  <Info />
                  <span>
                    Las que faltan pueden estar todavía procesando, o ser fotos donde no se ve
                    ninguna cara. Igual se venden: aparecen en tu galería.
                  </span>
                </div>
              )}
            </div>
          </section>
        )}

        {solapa === "equipo" && (
          <section className="panel-s" data-activo="1">
            <div className="card">
              <div className="card-h">
                <div>
                  <h2>Quiénes cubren este evento</h2>
                  <div className="sub">{colaboradores.length + 1} fotógrafos</div>
                </div>
                <Invitar eventId={evento.id} precio={evento.precio} />
              </div>

              {/* El dueño va en la tabla y no sólo en la cuenta del encabezado.
                  Decía "4 fotógrafos" y listaba tres, porque el cuarto era el
                  que estaba mirando. */}
              <div className="row col-f">
                <span className="col-av yo">{siglas(yo)}</span>
                <span className="col-t">
                  <b>{yo}</b>
                  <span>Vos, dueño del evento</span>
                </span>
                <span className="num soft c-fotos tnum">
                  {fotosDelDueno > 0 ? fotosDelDueno.toLocaleString("es-AR") : "—"}
                </span>
                <Rol clase="duenio" icono={<Crown />} texto="Dueño" />
              </div>

              {colaboradores.map((c) => (
                <div className={`row col-f ${c.estado === "PENDING" ? "espera" : ""}`} key={c.email}>
                  <span className="col-av">{siglas(c.nombre)}</span>
                  <span className="col-t">
                    <b>{c.nombre}</b>
                    <span>{c.email}</span>
                  </span>
                  <span className="num soft c-fotos tnum">
                    {c.fotos > 0 ? c.fotos.toLocaleString("es-AR") : "—"}
                  </span>
                  {c.estado === "PENDING" ? (
                    <Rol clase="espera" icono={<Clock />} texto="Invitado" />
                  ) : c.cobra ? (
                    <Rol clase="activo" icono={<CircleCheck />} texto="Activo" />
                  ) : (
                    // El estado que más duele: aceptó, subió fotos, la gente
                    // las encuentra y no las puede comprar porque no hay
                    // dónde depositarle.
                    <Rol clase="sincobrar" icono={<CircleAlert />} texto="Sin cobrar" />
                  )}
                </div>
              ))}

              {colaboradores.length === 0 && (
                <div className="empty" style={{ padding: "var(--s-6) var(--s-4)" }}>
                  <p>Todavía no invitaste a nadie más a cubrir este evento.</p>
                </div>
              )}

              {/* El aviso sólo aparece cuando hay alguien trabado, porque es el
                  caso en el que el dueño se entera tarde: el atleta encuentra
                  las fotos, no las puede pagar y le escribe a él. */}
              {sinCobrar.length > 0 && (
                <div className="porque" style={{ marginTop: "var(--s-4)" }}>
                  <CircleAlert />
                  <span>
                    {sinCobrar.length === 1 ? (
                      <>
                        <b>Las fotos de {sinCobrar[0]!.nombre.split(" ")[0]} no se pueden comprar.</b>{" "}
                        Todavía no conectó Mercado Pago, así que no hay dónde depositarle.
                      </>
                    ) : (
                      <>
                        <b>Hay {sinCobrar.length} fotógrafos sin Mercado Pago.</b> Sus fotos aparecen
                        en las búsquedas pero no se pueden comprar.
                      </>
                    )}
                  </span>
                </div>
              )}

              {/* Lo que pasa de verdad, no lo que decía el laboratorio. La
                  venta entra entera en el Mercado Pago del dueño; la comisión
                  del colaborador queda anotada como deuda y se la pasa él.
                  Decirlo al revés le prometía a un tercero una plata que el
                  sistema no le iba a devengar nunca. */}
              <div className="reparto">
                Todas las ventas entran en <b>tu</b> Mercado Pago, también las de las fotos que
                suban ellos. Lo que le toca a cada uno queda registrado como lo que les debés, y se
                lo pasás vos.
              </div>
            </div>
          </section>
        )}

        {solapa === "info" && (
          <section className="panel-s" data-activo="1">
            <Datos evento={evento} />
            <Borrar eventoId={evento.id} nombre={evento.nombre} fotos={evento.total} />
          </section>
        )}
      </div>
    </main>
  );
}

/**
 * Los datos del evento, editables acá mismo.
 *
 * Antes esto era una lista de sólo lectura y un botón que mandaba a
 * /dashboard/events/[id]/edit: se salía del panel nuevo para cambiar un lugar,
 * y se volvía a otra interfaz.
 *
 * La fecha va con <input type="date"> y no con el calendario dibujado del
 * laboratorio. El calendario propio son unas doscientas líneas para conseguir
 * lo mismo que el nativo, que además ya sabe de teclado, de lectores de
 * pantalla y del formato de fecha de quien lo usa.
 */
function Datos({
  evento,
}: {
  evento: {
    id: string;
    nombre: string;
    fechaISO: string | null;
    lugar: string | null;
    disciplina: string | null;
    descripcion: string | null;
  };
}) {
  const [d, setD] = useState({
    name: evento.nombre,
    eventDate: evento.fechaISO ?? "",
    location: evento.lugar ?? "",
    discipline: evento.disciplina ?? "",
    description: evento.descripcion ?? "",
  });
  const [guardando, empezar] = useTransition();
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const original = {
    name: evento.nombre,
    eventDate: evento.fechaISO ?? "",
    location: evento.lugar ?? "",
    discipline: evento.disciplina ?? "",
    description: evento.descripcion ?? "",
  };
  const cambiado = (Object.keys(d) as (keyof typeof d)[]).some((k) => d[k] !== original[k]);
  const cambiaElLink = d.name.trim() !== evento.nombre;

  const campo = (k: keyof typeof d) => ({
    value: d[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setD({ ...d, [k]: e.target.value }),
  });

  function guardar() {
    empezar(async () => {
      const r = await guardarDatosAction(evento.id, {
        name: d.name.trim(),
        location: d.location.trim() || undefined,
        discipline: d.discipline.trim() || undefined,
        eventDate: d.eventDate || undefined,
        description: d.description.trim() || undefined,
      });
      setError(!!r.error);
      setAviso(r.error ?? "Guardado");
      setTimeout(() => setAviso(null), 2400);
    });
  }

  return (
    <div className="card blq">
      <h2>Datos del evento</h2>
      <div className="blq-b">
        <div className="campo">
          <label htmlFor="nom">Nombre</label>
          <input className="inp" id="nom" {...campo("name")} />
          {/* Se avisa ANTES de guardar y no después. El panel viejo rehace la
              dirección al cambiar el nombre sin decir nada, y los links que ya
              se repartieron dejan de funcionar. */}
          {cambiaElLink && (
            <div className="pista">
              Cambiar el nombre cambia el link del evento. Los que ya compartiste dejan de funcionar.
            </div>
          )}
        </div>

        <div className="par">
          <div className="campo">
            <label htmlFor="fecha">Fecha</label>
            <Fecha
              id="fecha"
              valor={d.eventDate || null}
              alCambiar={(v) => setD({ ...d, eventDate: v ?? "" })}
            />
          </div>
          <div className="campo">
            <label htmlFor="lugar">Lugar</label>
            <input className="inp" id="lugar" placeholder="Chivilcoy, Buenos Aires" {...campo("location")} />
          </div>
        </div>

        <div className="campo">
          <label htmlFor="disc">Disciplina</label>
          {/* Las mismas opciones que el alta. Antes era texto libre, así que el
              mismo deporte terminaba escrito "Running", "running" y "Carrera"
              según el día, y eso después no se puede agrupar ni filtrar. */}
          <Desplegable
            id="disc"
            opciones={DISCIPLINAS.map((x) => ({ valor: x, texto: x }))}
            valor={d.discipline}
            alCambiar={(v) => setD({ ...d, discipline: v })}
          />
        </div>

        <div className="campo">
          <label htmlFor="desc">Descripción</label>
          <textarea
            className="ta"
            id="desc"
            placeholder="Un par de líneas para el atleta que llega desde el link."
            {...campo("description")}
          />
        </div>

        <div style={{ display: "flex", gap: "var(--s-3)", alignItems: "center" }}>
          <button
            className="btn btn-pri"
            type="button"
            onClick={guardar}
            disabled={guardando || !cambiado}
          >
            {guardando ? "Guardando" : "Guardar cambios"}
          </button>
          {aviso && (
            <span style={{ fontSize: 13, color: error ? "var(--bad)" : "var(--ok)" }}>{aviso}</span>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Borrar el evento.
 *
 * Pide escribir el nombre. Es más fricción que un "¿seguro?", y es a propósito:
 * esto se lleva puestas las fotos y el link público, y un diálogo de confirmar
 * se acepta sin leer cuando uno viene haciendo clicks.
 */
function Borrar({ eventoId, nombre, fotos }: { eventoId: string; nombre: string; fotos: number }) {
  const [confirmando, setConfirmando] = useState(false);
  const [escrito, setEscrito] = useState("");
  const [borrando, empezar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const coincide = escrito.trim().toLowerCase() === nombre.trim().toLowerCase();

  return (
    <div className="card blq riesgo">
      <h2>Borrar el evento</h2>
      <p className="ayuda">
        Se borran {fotos > 0 ? `las ${fotos.toLocaleString("es-AR")} fotos` : "las fotos"} y el link
        público deja de funcionar. Las ventas ya hechas quedan registradas y el que compró conserva
        su descarga. No se puede deshacer.
      </p>
      <div className="blq-b">
        {confirmando ? (
          <>
            <div className="campo">
              <label htmlFor="conf">
                Escribí <b>{nombre}</b> para confirmar
              </label>
              <input
                className="inp"
                id="conf"
                value={escrito}
                autoFocus
                onChange={(e) => setEscrito(e.target.value)}
              />
            </div>
            <div style={{ display: "flex", gap: "var(--s-2)", alignItems: "center" }}>
              <button
                type="button"
                className="btn btn-peligro"
                disabled={!coincide || borrando}
                onClick={() =>
                  empezar(async () => {
                    const r = await borrarEventoAction(eventoId);
                    // Si salió bien no se llega acá: la acción redirige.
                    if (r?.error) setError(r.error);
                  })
                }
              >
                <Trash2 /> {borrando ? "Borrando" : "Borrar para siempre"}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setConfirmando(false);
                  setEscrito("");
                }}
              >
                Cancelar
              </button>
              {error && <span style={{ color: "var(--bad)", fontSize: 13 }}>{error}</span>}
            </div>
          </>
        ) : (
          <button
            type="button"
            className="btn btn-peligro"
            style={{ justifySelf: "start" }}
            onClick={() => setConfirmando(true)}
          >
            Borrar este evento
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * El rol de cada fotógrafo, como texto.
 *
 * Antes eran píldoras. Una píldora es una caja con fondo, y cuatro cajas de
 * colores distintos en una columna angosta compiten con los nombres y los
 * números, que es lo que la tabla vino a mostrar. Como texto con ícono, el rol
 * se reconoce igual de rápido y deja de pelear por atención.
 */
function Rol({ clase, icono, texto }: { clase: string; icono: React.ReactNode; texto: string }) {
  return (
    <span className={`rol ${clase}`}>
      {icono} {texto}
    </span>
  );
}

/**
 * Cuánto sale una foto de este evento.
 *
 * La versión actual manda a editar el evento entero para tocar el precio, que
 * es un formulario con nombre, fecha, lugar y descripción, y termina en otra
 * pantalla. Cambiar un número no debería costar eso.
 *
 * Debajo del campo va lo que el fotógrafo realmente quiere saber, que no es el
 * precio sino cuánto le queda. Calcularlo mentalmente con una comisión de dos
 * dígitos es justo la fricción que hace que nadie ajuste precios nunca.
 */
function Precio({
  eventoId,
  inicial,
  comision,
}: {
  eventoId: string;
  inicial: number;
  comision: number;
}) {
  // Se guardan los dígitos pelados y se muestra con puntos: el separador es
  // presentación, y tenerlo en el estado obliga a limpiarlo en cada lectura.
  const [digitos, setDigitos] = useState(String(Math.round(inicial)));
  const campo = useRef<HTMLInputElement>(null);
  const [guardando, empezar] = useTransition();
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const n = Number(digitos);
  const valido = digitos !== "" && Number.isFinite(n) && n >= 0;
  const cambiado = valido && Math.round(n * 100) !== Math.round(inicial * 100);
  const neto = valido ? Math.round(n * (1 - comision / 100)) : 0;

  function guardar() {
    if (!valido || !cambiado) return;
    empezar(async () => {
      const r = await guardarPrecioAction(eventoId, n);
      setError(!!r.error);
      setAviso(r.error ?? "Precio actualizado");
      setTimeout(() => setAviso(null), 2400);
    });
  }

  return (
    <div className="card blq">
      <h2>Cuánto sale</h2>
      <p className="ayuda">
        Podés cambiarlo cuando quieras. El precio nuevo rige de acá en adelante; las ventas hechas no
        se tocan.
      </p>
      <div className="blq-b">
        <div className="precios">
          <div className="campo">
            <label htmlFor="p1">Una foto</label>
            <div className="pegado">
              <span className="fijo">$</span>
              <input
                ref={campo}
                className="inp tnum"
                id="p1"
                inputMode="numeric"
                value={digitos === "" ? "" : Number(digitos).toLocaleString("es-AR")}
                onChange={(e) => {
                  const el = e.target;
                  // Cuántos dígitos había antes del cursor. Reformatear corre
                  // el texto —escribir un dígito puede agregar un punto— y sin
                  // esto el cursor se va al final en medio de una corrección.
                  const antes = el.value.slice(0, el.selectionStart ?? 0).replace(/\D/g, "").length;
                  const limpio = el.value.replace(/\D/g, "").slice(0, 8);
                  setDigitos(limpio);

                  const puesto = limpio === "" ? "" : Number(limpio).toLocaleString("es-AR");
                  let pos = puesto.length;
                  for (let i = 0, d = 0; i < puesto.length; i++) {
                    if (/\d/.test(puesto[i]!)) d++;
                    if (d === antes) {
                      pos = i + 1;
                      break;
                    }
                  }
                  // En el próximo cuadro: React todavía no escribió el valor
                  // nuevo en el input, y mover el cursor ahora no serviría.
                  requestAnimationFrame(() => campo.current?.setSelectionRange(pos, pos));
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    guardar();
                  }
                }}
              />
            </div>
          </div>

          <div className="campo" style={{ justifyContent: "flex-end" }}>
            <button
              type="button"
              className="btn btn-pri"
              onClick={guardar}
              disabled={guardando || !valido || !cambiado}
            >
              {guardando ? "Guardando" : cambiado ? "Guardar precio" : "Guardado"}
            </button>
          </div>
        </div>

        <div className="cuenta-p">
          {valido ? (
            n === 0 ? (
              <>
                A <b>$0</b> las fotos se descargan gratis. Sirve para un evento de muestra, pero no
                vas a cobrar nada.
              </>
            ) : (
              <>
                Por cada foto vendida te quedan <b>${neto.toLocaleString("es-AR")}</b>, con la
                comisión de {comision}% ya descontada. Cae en tu Mercado Pago en el momento.
              </>
            )
          ) : (
            <>Poné un número.</>
          )}
        </div>

        {aviso && (
          <div style={{ fontSize: 13, color: error ? "var(--bad)" : "var(--ok)" }}>{aviso}</div>
        )}
      </div>
    </div>
  );
}
