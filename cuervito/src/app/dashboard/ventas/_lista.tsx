"use client";

import { Link2, Mail, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { iniciales as siglas, pesos } from "../_components/formato";

export type Venta = {
  id: string;
  quien: string;
  mail: string;
  evento: string;
  fotos: number;
  /** La cuenta, en centavos. Suma de las fotos, antes de nada. */
  subtotal: number;
  /** Lo que se descontó: cupón o promoción por cantidad. Cero si no hubo. */
  descuento: number;
  /** Lo que efectivamente pagó el comprador. */
  pago: number;
  /** Lo que le queda al fotógrafo, ya sin comisión. */
  neto: number;
  estado: string;
  fecha: string;
  /** Ya formateado en el servidor: hace() usa Date.now() y calcularlo de los
   *  dos lados hace que el HTML del servidor y el del cliente no coincidan. */
  hace: string;
  descargas: number;
  vence: string | null;
  token: string | null;
};

type FotoVenta = { id: string; filename: string; previewUrl: string };

const ESTADO: Record<string, { txt: string; cls: string }> = {
  PAID: { txt: "Acreditada", cls: "" },
  PENDING: { txt: "Pendiente", cls: "draft" },
  REFUNDED: { txt: "Reembolsada", cls: "bad" },
  FAILED: { txt: "Fallida", cls: "bad" },
  EXPIRED: { txt: "Vencida", cls: "bad" },
};

// Miniaturas que se muestran; el resto se resume en un "+N". Ocho llenan dos
// filas de cuatro, que es donde la grilla deja de ayudar a reconocer la compra
// y pasa a ser una pared.
const MINIS = 8;

/**
 * La tabla de ventas y el cajón con el detalle de una.
 *
 * El cajón existe porque el trabajo real acá es en tanda: llega un mail de
 * "no me llegaron las fotos" y hay que mirar cinco u ocho ventas seguidas. Con
 * navegación completa cada vuelta cuesta dos cargas y se pierde el lugar en la
 * lista; con el cajón la lista no se mueve.
 *
 * Las fotos se piden al abrir, contra el endpoint que ya usa el panel viejo.
 * Traerlas con la lista serían cientos de URLs firmadas de S3 para mirar, con
 * suerte, una.
 */
export function Lista({ ventas }: { ventas: Venta[] }) {
  const [abierta, setAbierta] = useState<Venta | null>(null);
  const [fotos, setFotos] = useState<FotoVenta[] | null>(null);
  const [cargando, setCargando] = useState(false);
  const [falloFotos, setFalloFotos] = useState(false);

  const [copiado, setCopiado] = useState(false);
  const [mandando, setMandando] = useState(false);
  const [avisoMail, setAvisoMail] = useState<string | null>(null);

  const cerrar = useRef<HTMLButtonElement>(null);

  // El estado del cajón vive en el <html> porque la animación de entrada y el
  // velo cuelgan de :root[data-venta="open"] en el CSS del laboratorio.
  useEffect(() => {
    document.documentElement.dataset.venta = abierta ? "open" : "";
    return () => {
      document.documentElement.dataset.venta = "";
    };
  }, [abierta]);

  // Escape cierra. Es lo primero que prueba cualquiera con algo abierto encima.
  useEffect(() => {
    if (!abierta) return;
    const alTecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierta(null);
    };
    window.addEventListener("keydown", alTecla);
    return () => window.removeEventListener("keydown", alTecla);
  }, [abierta]);

  useEffect(() => {
    if (!abierta) return;
    cerrar.current?.focus();

    setFotos(null);
    setFalloFotos(false);
    setCargando(true);

    // Se aborta al abrir otra: mirando ventas seguidas, la respuesta de la
    // anterior puede llegar después y pintar las fotos equivocadas sobre la
    // venta que se está mirando.
    const corte = new AbortController();
    fetch(`/api/sales/${abierta.id}/photos`, { signal: corte.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { photos: FotoVenta[] }) => setFotos(d.photos))
      .catch((e) => {
        if ((e as Error).name !== "AbortError") setFalloFotos(true);
      })
      .finally(() => {
        if (!corte.signal.aborted) setCargando(false);
      });

    return () => corte.abort();
  }, [abierta]);

  useEffect(() => {
    setCopiado(false);
    setAvisoMail(null);
  }, [abierta]);

  async function copiarLink() {
    if (!abierta?.token) return;
    const url = `${window.location.origin}/descarga/${abierta.token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sin permiso de portapapeles: al menos que lo pueda copiar a mano.
      window.prompt("Copiá el link de descarga:", url);
    }
  }

  async function reenviar() {
    if (!abierta) return;
    setMandando(true);
    setAvisoMail(null);
    try {
      const r = await fetch(`/api/sales/${abierta.id}/resend-email`, { method: "POST" });
      const d = (await r.json().catch(() => ({}))) as { error?: string };
      setAvisoMail(r.ok ? `Reenviado a ${abierta.mail}` : (d.error ?? "No se pudo reenviar"));
    } catch {
      setAvisoMail("No se pudo reenviar");
    } finally {
      setMandando(false);
    }
  }

  const e = abierta ? (ESTADO[abierta.estado] ?? { txt: abierta.estado, cls: "" }) : null;
  const sobrantes = abierta && fotos ? abierta.fotos - Math.min(fotos.length, MINIS) : 0;

  return (
    <>
      <div className="row row-h vt">
        <span />
        <span>Comprador</span>
        <span className="c-ev">Evento</span>
        <span className="num c-fotos">Fotos</span>
        <span className="num c-fecha">Fecha</span>
        <span className="num">Te queda</span>
        <span className="c-estado" />
      </div>

      {ventas.map((v) => {
        const es = ESTADO[v.estado] ?? { txt: v.estado, cls: "" };
        return (
          <div
            key={v.id}
            className="row vt"
            role="button"
            tabIndex={0}
            aria-haspopup="dialog"
            onClick={() => setAbierta(v)}
            onKeyDown={(ev) => {
              if (ev.key === "Enter" || ev.key === " ") {
                ev.preventDefault();
                setAbierta(v);
              }
            }}
          >
            <span className="v-av">{siglas(v.quien)}</span>
            <span className="v-who">
              <b>{v.quien}</b>
              <span>{v.mail}</span>
            </span>
            <span className="v-ev c-ev">{v.evento}</span>
            <span className="num soft c-fotos">{v.fotos}</span>
            <span className="num soft c-fecha">{v.hace}</span>
            <span className="num tnum neto">{pesos(v.neto)}</span>
            <span className={`pill ${es.cls} c-estado`}>
              <i /> {es.txt}
            </span>
          </div>
        );
      })}

      <div className="dscrim" onClick={() => setAbierta(null)} />

      <aside className="drw" aria-label="Detalle de la venta" aria-hidden={!abierta}>
        {abierta && (
          <>
            <div className="drw-h">
              <div>
                <h2>{abierta.quien}</h2>
                <div className="sub">{abierta.mail}</div>
              </div>
              <button
                ref={cerrar}
                className="btn btn-ghost btn-icon"
                onClick={() => setAbierta(null)}
                aria-label="Cerrar"
              >
                <X />
              </button>
            </div>

            <div className="drw-b">
              <div>
                <div className="card-h">
                  <div>
                    <h2>Fotos compradas</h2>
                  </div>
                </div>
                <div className="minis">
                  {cargando &&
                    Array.from({ length: Math.min(abierta.fotos, 4) }).map((_, i) => (
                      <div key={i} className="mini sk" />
                    ))}

                  {fotos?.slice(0, MINIS).map((f) => (
                    <div
                      key={f.id}
                      className="mini"
                      style={{
                        backgroundImage: `url(${f.previewUrl})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }}
                      title={f.filename}
                    />
                  ))}

                  {sobrantes > 0 && <div className="mini mas">+{sobrantes}</div>}
                </div>

                {falloFotos && (
                  <div className="detalle" style={{ marginTop: 10 }}>
                    No se pudieron cargar las miniaturas. La venta y el link de descarga están bien.
                  </div>
                )}
                {/* Se puede borrar el álbum entero y liberar S3 sin tocar las
                    ventas cobradas, así que una venta vieja puede quedarse sin
                    fotos que mostrar. Decirlo evita que parezca una falla. */}
                {!cargando && !falloFotos && fotos?.length === 0 && (
                  <div className="detalle" style={{ marginTop: 10 }}>
                    Estas fotos ya no están en el servidor. La venta sigue siendo válida.
                  </div>
                )}
              </div>

              {/* La cuenta entera y no sólo el resultado.

                  Antes acá había una sola línea con lo que ganó, así que una
                  venta con cupón mostraba un número más chico que el precio de
                  las fotos y no había forma de saber por qué. El descuento
                  existe —está en la venta— pero no se mostraba en ningún lado
                  del panel.

                  La comisión sale de restar y no del campo platformFeeCents:
                  si la venta tuvo comisión de referido, el campo solo no
                  cierra y la cuenta que el fotógrafo tiene delante no da. */}
              <div className="desg">
                <dl className="dl">
                  <div>
                    <dt>
                      {abierta.fotos} {abierta.fotos === 1 ? "foto" : "fotos"}
                    </dt>
                    <dd className="tnum">{pesos(abierta.subtotal)}</dd>
                  </div>

                  {abierta.descuento > 0 && (
                    <div className="resta">
                      <dt>Descuento</dt>
                      <dd className="tnum">−{pesos(abierta.descuento)}</dd>
                    </div>
                  )}

                  {abierta.pago - abierta.neto > 0 && (
                    <div className="resta">
                      <dt>Comisión ({Math.round(((abierta.pago - abierta.neto) / abierta.pago) * 100)}%)</dt>
                      <dd className="tnum">−{pesos(abierta.pago - abierta.neto)}</dd>
                    </div>
                  )}

                  <div className="tot">
                    <dt>Ganaste</dt>
                    <dd className="tnum">{pesos(abierta.neto)}</dd>
                  </div>
                </dl>
              </div>

              <dl className="dl">
                <div>
                  <dt>Evento</dt>
                  <dd>{abierta.evento}</dd>
                </div>
                <div>
                  <dt>Fecha</dt>
                  <dd>
                    {new Date(abierta.fecha).toLocaleDateString("es-AR", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </dd>
                </div>
                <div>
                  <dt>Estado</dt>
                  <dd>{e?.txt}</dd>
                </div>
                <div>
                  <dt>Descargas</dt>
                  {/* Cero descargas con la venta cobrada es el caso que hay que
                      poder ver de un vistazo: es exactamente el que escribe
                      diciendo que no le llegaron las fotos. */}
                  <dd>{abierta.descargas === 0 ? "Todavía no descargó" : abierta.descargas}</dd>
                </div>
                <div>
                  <dt>Link vence</dt>
                  <dd>
                    {abierta.vence
                      ? new Date(abierta.vence) < new Date()
                        ? "Vencido"
                        : new Date(abierta.vence).toLocaleDateString("es-AR", {
                            day: "numeric",
                            month: "long",
                          })
                      : "—"}
                  </dd>
                </div>
              </dl>

              {avisoMail && <div className="detalle">{avisoMail}</div>}
            </div>

            <div className="drw-f">
              <button
                className="btn btn-ghost btn-block"
                onClick={copiarLink}
                disabled={!abierta.token}
              >
                <Link2 /> {copiado ? "Copiado" : "Copiar link de descarga"}
              </button>
              <button
                className="btn btn-ghost btn-icon"
                onClick={reenviar}
                disabled={mandando || !abierta.token}
                aria-label="Reenviar por mail"
                title={`Reenviar a ${abierta.mail}`}
              >
                <Mail />
              </button>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
