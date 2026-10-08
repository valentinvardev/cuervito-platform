"use client";

import { ArrowLeft, ArrowRight, Check, Loader2, Pencil, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

import { PLANTILLA_POR_DEFECTO, PLANTILLAS, type IdPlantilla } from "~/app/_portfolio/plantillas/registro";

import { slugDeNombre } from "../../_components/formato";
import {
  crearPortfolioAction,
  direccionLibreAction,
  fotosDeEventoAction,
  type FotoParaElegir,
  publicarPortfolioAction,
} from "../acciones";
import { VistaEscalada } from "../_vista";

export type EventoParaElegir = {
  id: string;
  nombre: string;
  disciplina: string | null;
  fecha: string | null;
  fotos: number;
  tapa: string | null;
};

type Elegida = { photoId: string; grupo: string; src: string };
type Lote = { fotos: FotoParaElegir[]; hayMas: boolean; orden: "vendidas" | "todas" };

const PASOS = ["Nombre", "Fotos", "Plantilla", "Listo"];
const MINIMO = 1;
const SUGERIDO = { desde: 12, hasta: 40 };

function fechaCorta(iso: string | null) {
  if (!iso) return "";
  const [, m, d] = iso.split("-");
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${Number(d)} ${meses[Number(m) - 1]}`;
}

/**
 * El asistente, en cuatro pasos. Nada se guarda hasta el tercero: recién al
 * elegir la plantilla se crea el portfolio (en borrador), así no quedan
 * portfolios a medio hacer de quien abrió el asistente y se fue.
 */
export function Asistente({ eventos, slugFotografo }: { eventos: EventoParaElegir[]; slugFotografo: string }) {
  const router = useRouter();
  const [paso, setPaso] = useState(0);

  // Paso 1
  const [nombre, setNombre] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTocado, setSlugTocado] = useState(false);
  const [libre, setLibre] = useState<boolean | null>(null);
  const [errorSlug, setErrorSlug] = useState<string | null>(null);
  const [disciplina, setDisciplina] = useState<string | null>(null);

  // Paso 2
  const [eventoId, setEventoId] = useState<string | null>(eventos[0]?.id ?? null);
  const [orden, setOrden] = useState<"vendidas" | "todas">("vendidas");
  const [lotes, setLotes] = useState<Record<string, Lote>>({});
  const [cargando, setCargando] = useState(false);
  const [elegidas, setElegidas] = useState<Elegida[]>([]);

  // Paso 3 y 4
  const [plantilla, setPlantilla] = useState<IdPlantilla>(PLANTILLA_POR_DEFECTO);
  const [creado, setCreado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();

  /* La dirección sale del nombre hasta que se la toca a mano. */
  useEffect(() => {
    if (!slugTocado) setSlug(slugDeNombre(nombre).slice(0, 60));
  }, [nombre, slugTocado]);

  /* ¿Libre? Con un respiro, para no preguntar en cada tecla. */
  useEffect(() => {
    setLibre(null);
    setErrorSlug(null);
    if (slug.length < 2) return;
    const t = setTimeout(() => {
      void direccionLibreAction(slug).then((r) => {
        setLibre(r.libre);
        setErrorSlug(r.error);
      });
    }, 350);
    return () => clearTimeout(t);
  }, [slug]);

  /* Eventos: los de la disciplina elegida, primero. */
  const disciplinas = useMemo(
    () => [...new Set(eventos.map((e) => e.disciplina).filter((d): d is string => Boolean(d)))],
    [eventos],
  );
  const ordenados = useMemo(() => {
    if (!disciplina) return eventos;
    return [...eventos].sort((a, b) => Number(b.disciplina === disciplina) - Number(a.disciplina === disciplina));
  }, [eventos, disciplina]);

  /* Las fotos del evento abierto, una vez por evento y orden. */
  const clave = eventoId ? `${eventoId}:${orden}` : null;
  const lote = clave ? lotes[clave] : undefined;
  useEffect(() => {
    if (paso !== 1 || !eventoId || !clave || lotes[clave]) return;
    setCargando(true);
    void fotosDeEventoAction(eventoId, orden).then((r) => {
      setLotes((l) => ({ ...l, [clave]: { fotos: r.fotos, hayMas: r.hayMas, orden: r.orden } }));
      setCargando(false);
    });
  }, [paso, eventoId, orden, clave, lotes]);

  function verMas() {
    if (!eventoId || !clave || !lote) return;
    setCargando(true);
    void fotosDeEventoAction(eventoId, lote.orden, lote.fotos.length).then((r) => {
      setLotes((l) => ({ ...l, [clave]: { fotos: [...lote.fotos, ...r.fotos], hayMas: r.hayMas, orden: r.orden } }));
      setCargando(false);
    });
  }

  const evento = eventos.find((e) => e.id === eventoId);
  const indice = useMemo(() => new Map(elegidas.map((e, i) => [e.photoId, i])), [elegidas]);
  const porEvento = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of elegidas) m.set(e.grupo, (m.get(e.grupo) ?? 0) + 1);
    return m;
  }, [elegidas]);

  function alternar(f: FotoParaElegir) {
    if (!evento) return;
    setElegidas((xs) =>
      xs.some((x) => x.photoId === f.id)
        ? xs.filter((x) => x.photoId !== f.id)
        : [...xs, { photoId: f.id, grupo: evento.nombre, src: f.src }],
    );
  }

  const puedeSeguir =
    paso === 0 ? nombre.trim().length > 0 && libre === true : paso === 1 ? elegidas.length >= MINIMO : true;

  function crear() {
    setError(null);
    empezar(async () => {
      const r = await crearPortfolioAction({
        nombre: nombre.trim(),
        slug,
        plantilla,
        fotos: elegidas.map((e) => ({ photoId: e.photoId, grupo: e.grupo })),
      });
      if (r.error ?? !r.id) {
        setError(r.error ?? "No se pudo crear.");
        return;
      }
      setCreado(r.id);
      setPaso(3);
    });
  }

  function publicar() {
    if (!creado) return;
    setError(null);
    empezar(async () => {
      const r = await publicarPortfolioAction(creado, true);
      if (r.error) {
        setError(r.error);
        return;
      }
      router.push(`/dashboard/portfolio/${creado}`);
    });
  }

  function siguiente() {
    if (paso === 2) crear();
    else setPaso((p) => p + 1);
  }

  const idsElegidas = elegidas.map((e) => e.photoId).join(",");

  return (
    <div className="pfa">
      <header className="pfa-barra">
        {paso === 0 || paso === 3 ? (
          <Link href="/dashboard/portfolio" className="volver">
            <ArrowLeft /> Portfolio
          </Link>
        ) : (
          <button type="button" className="volver" onClick={() => setPaso((p) => p - 1)} style={{ background: "none", border: 0, cursor: "pointer", font: "inherit" }}>
            <ArrowLeft /> Volver
          </button>
        )}
        <ol className="pfa-pasos">
          {PASOS.map((t, i) => (
            <li key={t} data-estado={i < paso ? "hecho" : i === paso ? "actual" : undefined}>
              <i>{i < paso ? <Check /> : i + 1}</i>
              <span>{t}</span>
            </li>
          ))}
        </ol>
        <span className="guardado">{paso < 3 ? "Se guarda al elegir la plantilla" : "Guardado como borrador"}</span>
      </header>

      {paso === 0 && (
        <div className="pfa-cuerpo">
          <div className="pfa-centro">
            <div className="pfa-form">
              <div className="pfa-titulo">
                <span className="cap">Paso 1 de 4</span>
                <h1>¿Cómo se llama?</h1>
                <p>Es para vos: no aparece en la página. Ponele algo que te sirva para encontrarlo, como la disciplina o la temporada.</p>
              </div>

              <div className="campo">
                <label htmlFor="pf-nombre">Nombre</label>
                <input
                  id="pf-nombre"
                  className="inp"
                  value={nombre}
                  maxLength={80}
                  autoFocus
                  placeholder="Running 2026"
                  onChange={(e) => setNombre(e.target.value)}
                />
              </div>

              <div className="campo">
                <label htmlFor="pf-slug">Dirección</label>
                <div className="pfa-dir">
                  <span>encontrate.app/{slugFotografo}/p/</span>
                  <input
                    id="pf-slug"
                    value={slug}
                    maxLength={60}
                    onChange={(e) => {
                      setSlugTocado(true);
                      setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
                    }}
                  />
                  {libre === true && (
                    <span className="estado libre"><Check /> Libre</span>
                  )}
                  {libre === false && (
                    <span className="estado ocupada"><X /> Ya la usás</span>
                  )}
                </div>
                <span className="pista">{errorSlug ?? "Sale del nombre; la podés cambiar."}</span>
              </div>

              {disciplinas.length > 1 && (
                <div className="campo">
                  <label>¿De qué es?</label>
                  <span className="pista">Opcional. Te mostramos primero los eventos de esa disciplina.</span>
                  <div className="chips">
                    {disciplinas.map((d) => (
                      <button
                        key={d}
                        type="button"
                        className="chip-f"
                        aria-pressed={disciplina === d}
                        onClick={() => setDisciplina((x) => (x === d ? null : d))}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {paso === 1 && (
        <div className="pfa-cuerpo">
          <aside className="pfa-eventos">
            <span className="cap">Tus eventos{disciplina ? ` · ${disciplina} primero` : ""}</span>
            {ordenados.length === 0 && <p className="pista">Todavía no tenés eventos con fotos procesadas.</p>}
            {ordenados.map((e) => {
              const n = porEvento.get(e.nombre) ?? 0;
              return (
                <button key={e.id} type="button" className="pfa-evento" aria-current={e.id === eventoId} onClick={() => setEventoId(e.id)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {e.tapa ? <img src={e.tapa} alt="" /> : <span className="sin" />}
                  <div>
                    <b>{e.nombre}</b>
                    <small>
                      {[fechaCorta(e.fecha), `${e.fotos.toLocaleString("es-AR")} fotos`].filter(Boolean).join(" · ")}
                    </small>
                  </div>
                  {n > 0 && <i className={`n${e.id === eventoId ? " lleno" : ""}`}>{n}</i>}
                </button>
              );
            })}
          </aside>

          <section className="pfa-fotos">
            <div className="pfa-fotos-h">
              <div>
                <h1>Elegí tus mejores fotos</h1>
                <p>
                  Entre {SUGERIDO.desde} y {SUGERIDO.hasta} funciona bien. Las vas a poder ordenar y cambiar después.
                </p>
              </div>
              <div className="seg" role="group" aria-label="Orden">
                <button type="button" aria-pressed={orden === "vendidas"} onClick={() => setOrden("vendidas")}>
                  Las que más se vendieron
                </button>
                <button type="button" aria-pressed={orden === "todas"} onClick={() => setOrden("todas")}>
                  Todas
                </button>
              </div>
            </div>

            {lote && lote.orden !== orden && (
              <p className="pista">Este evento todavía no vendió fotos: te mostramos todas.</p>
            )}

            <div className="pfa-grilla">
              {lote?.fotos.map((f) => {
                const i = indice.get(f.id);
                return (
                  <button key={f.id} type="button" className="pfa-foto" aria-pressed={i !== undefined} onClick={() => alternar(f)}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={f.src} alt="" loading="lazy" />
                    <span className="marca">{i !== undefined ? i + 1 : ""}</span>
                    {f.ventas > 0 && <span className="ventas">{f.ventas} {f.ventas === 1 ? "venta" : "ventas"}</span>}
                  </button>
                );
              })}
            </div>
            {cargando && (
              <div className="pfa-mas"><Loader2 className="pf-gira" aria-label="Cargando" /></div>
            )}
            {!cargando && lote?.hayMas && (
              <div className="pfa-mas">
                <button type="button" className="btn btn-ghost" onClick={verMas}>Ver más fotos</button>
              </div>
            )}
          </section>
        </div>
      )}

      {paso === 2 && (
        <div className="pfa-cuerpo" style={{ flexDirection: "column" }}>
          <div className="pfa-fotos-h" style={{ padding: "var(--s-6) var(--s-6) var(--s-4)" }}>
            <div>
              <h1>Elegí cómo se ve</h1>
              <p>Ya tienen tus {elegidas.length} fotos. Colores, letras y textos se cambian después en el editor.</p>
            </div>
          </div>
          <div className="pfa-plantillas">
            {(Object.keys(PLANTILLAS) as IdPlantilla[]).map((id) => (
              <button key={id} type="button" className="pfa-plantilla" aria-pressed={plantilla === id} onClick={() => setPlantilla(id)}>
                <VistaEscalada src={`/vista-portfolio/${id}?fotos=${idsElegidas}`} ancho={1280} alto={1706} className="vista" titulo={`Vista de ${PLANTILLAS[id].name}`} />
                <div className="pie">
                  <div>
                    <b>{PLANTILLAS[id].name}</b>
                    <span>{PLANTILLAS[id].descripcion}</span>
                  </div>
                  <span className="tilde">{plantilla === id && <Check />}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {paso === 3 && creado && (
        <div className="pfa-cuerpo">
          <div className="pfa-centro" style={{ alignItems: "center", gap: "var(--s-7)", flexWrap: "wrap" }}>
            <div className="pfa-form" style={{ maxWidth: 440 }}>
              <div className="pfa-titulo">
                <span className="cap" style={{ color: "var(--ok)" }}>Listo</span>
                <h1>Tu portfolio está armado</h1>
                <p>Todavía es un borrador: nadie lo ve hasta que lo publiques. Antes, cambiá el título y el «sobre mí» por los tuyos.</p>
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                <Link href={`/dashboard/portfolio/${creado}/editor`} className="btn btn-pri btn-lg">
                  <Pencil /> Editar textos y diseño
                </Link>
                <button type="button" className="btn btn-ghost btn-lg" onClick={publicar} disabled={pendiente}>
                  {pendiente ? "Publicando…" : "Publicar así como está"}
                </button>
              </div>
              <span className="pista">Va a estar en encontrate.app/{slugFotografo}/p/{slug}</span>
              {error && <p className="pfa-error">{error}</p>}
            </div>
            <VistaEscalada
              src={`/${slugFotografo}/p/${slug}`}
              ancho={1280}
              alto={900}
              className="pf-previa"
              estilo={{ width: "min(620px, 100%)", aspectRatio: "1280 / 900" }}
              titulo="Vista previa del portfolio"
            />
          </div>
        </div>
      )}

      {paso < 3 && (
        <footer className="pfa-pie">
          {paso === 0 ? (
            <Link href="/dashboard/portfolio" className="btn btn-ghost">Cancelar</Link>
          ) : (
            <button type="button" className="btn btn-ghost" onClick={() => setPaso((p) => p - 1)}>Volver</button>
          )}
          <div className="medio">
            {paso >= 1 && elegidas.length > 0 && (
              <>
                <span className="apilado">
                  {elegidas.slice(0, 3).map((e) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={e.photoId} src={e.src} alt="" />
                  ))}
                </span>
                <b>{elegidas.length} {elegidas.length === 1 ? "elegida" : "elegidas"}</b>
                <small>de {porEvento.size} {porEvento.size === 1 ? "evento" : "eventos"}</small>
              </>
            )}
            {error && <span className="pfa-error">{error}</span>}
          </div>
          <button type="button" className="btn btn-pri btn-lg" disabled={!puedeSeguir || pendiente} onClick={siguiente}>
            {paso === 0 ? "Elegir fotos" : paso === 1 ? "Elegir plantilla" : pendiente ? "Creando…" : "Crear portfolio"}
            <ArrowRight className="go" />
          </button>
        </footer>
      )}
    </div>
  );
}
