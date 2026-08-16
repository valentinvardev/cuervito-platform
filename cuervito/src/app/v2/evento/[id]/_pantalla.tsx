"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Check,
  CloudUpload,
  Copy,
  ExternalLink,
  Image as ImagenIcono,
  Info,
  ListFilter,
  ScanFace,
  ScanSearch,
  ShoppingBag,
  Tag,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";

type Foto = { id: string; url: string | null; bib: string | null; vendida: boolean; reconocida: boolean };
type Colaborador = { nombre: string; email: string; estado: string; fotos: number; cobra: boolean };

const POR_PAG = 20;

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
}: {
  evento: {
    id: string;
    nombre: string;
    fecha: string | null;
    lugar: string | null;
    disciplina: string | null;
    portada: string | null;
    publicado: boolean;
    precio: number;
    descripcion: string | null;
    total: number;
    reconocidas: number;
    ventas: number;
    recaudado: string;
  };
  fotos: Foto[];
  colaboradores: Colaborador[];
  publico: string | null;
}) {
  const [solapa, setSolapa] = useState<"fotos" | "equipo" | "info">("fotos");
  const [filtro, setFiltro] = useState<string>("todas");
  const [buscado, setBuscado] = useState("");
  const [pagina, setPagina] = useState(1);
  const [abierto, setAbierto] = useState(false);
  const [copiado, setCopiado] = useState(false);

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
        <Link href="/v2/eventos" className="btn btn-ghost btn-sm" style={{ justifySelf: "start" }}>
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
            <div className="banda-acc">
              <Link href={`/dashboard/events/${evento.id}`} className="btn btn-vidrio">
                Editar en el panel actual
              </Link>
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
            </div>

            {trozo.length > 0 ? (
              <>
                <div className="fg">
                  {trozo.map((f) => (
                    <div className="ft" key={f.id}>
                      <div
                        className="ft-i"
                        style={f.url ? { backgroundImage: `url(${f.url})`, backgroundSize: "cover" } : undefined}
                      />
                      <div className="ft-v" />
                      {!f.reconocida && (
                        <span className="ft-f warn">
                          <ScanFace />
                        </span>
                      )}
                      {f.vendida && (
                        <span className="ft-f sold">
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
                      </div>
                    </div>
                  ))}
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
                <h3>{buscado ? "Ninguna foto con ese dorsal" : "No hay fotos con ese filtro"}</h3>
                <p>
                  {buscado
                    ? "Puede que el dorsal no se haya leído bien, o que esa foto todavía esté procesando."
                    : "Probá con otro filtro."}
                </p>
              </div>
            )}
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
                <Link href={`/dashboard/events/${evento.id}`} className="btn btn-pri btn-sm">
                  Invitar
                </Link>
              </div>

              {colaboradores.length > 0 ? (
                colaboradores.map((c) => (
                  <div className="row col-f" key={c.email}>
                    <span className="col-av">
                      {c.nombre
                        .split(" ")
                        .map((p) => p[0]?.toUpperCase() ?? "")
                        .slice(0, 2)
                        .join("")}
                    </span>
                    <span className="col-t">
                      <b>{c.nombre}</b>
                      <span>{c.email}</span>
                    </span>
                    <span className="num soft c-fotos tnum">
                      {c.fotos > 0 ? c.fotos.toLocaleString("es-AR") : "—"}
                    </span>
                    {c.estado === "PENDING" ? (
                      <span className="pill draft">
                        <i /> Invitado
                      </span>
                    ) : c.cobra ? (
                      <span className="pill live">
                        <i /> Activo
                      </span>
                    ) : (
                      // El estado que más duele: aceptó, subió fotos, la gente
                      // las encuentra y no las puede comprar porque no hay
                      // dónde depositarle.
                      <span className="pill bad">
                        <i /> Sin cobrar
                      </span>
                    )}
                  </div>
                ))
              ) : (
                <div className="empty" style={{ padding: "var(--s-6) var(--s-4)" }}>
                  <p>Todavía no invitaste a nadie a cubrir este evento.</p>
                </div>
              )}

              <div className="reparto">
                Cada uno cobra <b>las ventas de sus propias fotos</b>, directo a su Mercado Pago. No hay
                plata que pasarse entre ustedes.
              </div>
            </div>
          </section>
        )}

        {solapa === "info" && (
          <section className="panel-s" data-activo="1">
            <div className="card blq">
              <h2>Datos del evento</h2>
              <div className="blq-b">
                <dl className="dl">
                  <div>
                    <dt>Nombre</dt>
                    <dd>{evento.nombre}</dd>
                  </div>
                  <div>
                    <dt>Fecha</dt>
                    <dd>{evento.fecha ?? "Sin fecha"}</dd>
                  </div>
                  <div>
                    <dt>Lugar</dt>
                    <dd>{evento.lugar ?? "—"}</dd>
                  </div>
                  <div>
                    <dt>Disciplina</dt>
                    <dd>{evento.disciplina ?? "—"}</dd>
                  </div>
                  <div>
                    <dt>Precio por foto</dt>
                    <dd className="tnum">${evento.precio.toLocaleString("es-AR")}</dd>
                  </div>
                </dl>

                {evento.descripcion && (
                  <div className="cuenta-p" style={{ marginTop: "var(--s-3)" }}>
                    {evento.descripcion}
                  </div>
                )}

                {/* Editar todavía vive en el panel actual: duplicar el
                    formulario acá sería una segunda validación del mismo dato,
                    lista para divergir de la que ya funciona. */}
                <Link
                  href={`/dashboard/events/${evento.id}/edit`}
                  className="btn btn-ghost"
                  style={{ justifySelf: "start" }}
                >
                  <CloudUpload /> Editar en el panel actual
                </Link>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
