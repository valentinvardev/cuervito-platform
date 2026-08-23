"use client";

import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Image as ImagenIcono,
  Images,
  Info,
  ScanFace,
  X,
} from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";

import { Desplegable } from "../_components/desplegable";
import { Fecha } from "../_components/fecha";
import { crearEventoAction } from "./acciones";
import { COMISION_CON, COMISION_SIN } from "./tarifas";

const PASOS = ["El evento", "Cómo se encuentran", "Precio"];

const DISCIPLINAS = ["Running", "Ciclismo", "Trail", "Duatlón", "Triatlón", "MTB", "Otra"];

const PRECIO_INICIAL = 1800;

/** Tope de la portada. El mismo que acepta el endpoint. */
const MAX_PORTADA = 8 * 1024 * 1024;

function conPuntos(digitos: string) {
  return digitos === "" ? "" : Number(digitos).toLocaleString("es-AR");
}

/**
 * Alta de evento, en tres pasos.
 *
 * La versión actual es un formulario de una pantalla con nombre, disciplina,
 * lugar, fecha, precio, descripción y portada, todo junto. Funciona, pero pone
 * al mismo nivel el nombre del evento —que hay que pensar— y el precio, que
 * conviene decidir sabiendo cuánto queda después de la comisión. Y sobre todo
 * no hay dónde explicar el reconocimiento, que es lo que define lo que
 * cobramos: aparecía como un hecho consumado recién al ver la primera venta.
 *
 * Frena sólo en el paso 1, y sólo por el nombre. Los pasos 2 y 3 vienen con
 * valores razonables: quien quiera terminar rápido aprieta Seguir dos veces y
 * el evento queda con reconocimiento y a $1.800.
 */
export function Asistente() {
  const router = useRouter();
  const [paso, setPaso] = useState(1);

  const [nombre, setNombre] = useState("");
  const [fecha, setFecha] = useState("");
  const [lugar, setLugar] = useState("");
  const [disciplina, setDisciplina] = useState("");
  const [reconocimiento, setReconocimiento] = useState(true);
  const [precio, setPrecio] = useState(String(PRECIO_INICIAL));

  const [portada, setPortada] = useState<File | null>(null);
  const [previaPortada, setPreviaPortada] = useState<string | null>(null);
  const [errorPortada, setErrorPortada] = useState<string | null>(null);
  const archivo = useRef<HTMLInputElement>(null);
  const campoPrecio = useRef<HTMLInputElement>(null);

  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tocado, setTocado] = useState(false);

  useEffect(() => {
    if (!portada) {
      setPreviaPortada(null);
      return;
    }
    const url = URL.createObjectURL(portada);
    setPreviaPortada(url);
    // Sin esto cada portada elegida deja su blob en memoria hasta recargar.
    return () => URL.revokeObjectURL(url);
  }, [portada]);

  const comision = reconocimiento ? COMISION_CON : COMISION_SIN;
  const n = Number(precio);
  const precioOk = precio !== "" && Number.isFinite(n) && n >= 0;
  const neto = precioOk ? Math.round(n * (1 - comision / 100)) : 0;
  const fee = precioOk ? Math.round((n * comision) / 100) : 0;

  const nombreOk = nombre.trim().length >= 3;

  function elegirPortada(f: File | undefined) {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setErrorPortada("Tiene que ser una imagen.");
      return;
    }
    if (f.size > MAX_PORTADA) {
      setErrorPortada(`Máximo ${MAX_PORTADA / 1024 / 1024} MB. Ésta pesa ${(f.size / 1024 / 1024).toFixed(1)}.`);
      return;
    }
    setErrorPortada(null);
    setPortada(f);
  }

  async function crear() {
    setEnviando(true);
    setError(null);
    const r = await crearEventoAction({
      name: nombre.trim(),
      location: lugar.trim() || undefined,
      discipline: disciplina || undefined,
      eventDate: fecha || undefined,
      recognition: reconocimiento,
      pricePerPhoto: n,
    });

    if (r.error ?? !r.id) {
      setError(r.error ?? "No se pudo crear el evento.");
      setEnviando(false);
      return;
    }

    // La portada viaja después y aparte, porque es un archivo y la acción
    // recibe datos. Si falla, el evento igual quedó creado: perder el evento
    // entero porque no se pudo subir una imagen sería el peor de los canjes.
    if (portada) {
      try {
        const fd = new FormData();
        fd.append("cover", portada);
        await fetch(`/api/dashboard/events/${r.id}/cover`, { method: "POST", body: fd });
      } catch {
        // Se puede poner desde la pantalla del evento.
      }
    }

    router.push(`/dashboard/evento/${r.id}`);
  }

  function seguir() {
    if (paso === 1) {
      setTocado(true);
      if (!nombreOk) return;
      setPaso(2);
      return;
    }
    if (paso === 2) {
      setPaso(3);
      return;
    }
    void crear();
  }

  return (
    <div className="wiz">
      <div>
        <div className="wpasos">
          {PASOS.map((t, i) => {
            const n1 = i + 1;
            return (
              <Fragment key={t}>
                <span
                  className="wp"
                  data-n={n1}
                  data-e={n1 === paso ? "aqui" : n1 < paso ? "hecho" : undefined}
                >
                  {/* Sólo el número. Para el paso ya hecho, el CSS esconde este
                      span y dibuja el tilde con una máscara sobre el círculo
                      verde; poner acá un ícono de tilde da dos, y como .bola es
                      una grilla el segundo cae en su propia fila, abajo. */}
                  <i className="bola">
                    <span>{n1}</span>
                  </i>
                  <span className="txt">{t}</span>
                </span>
                {n1 < PASOS.length && <span className="wp-linea" />}
              </Fragment>
            );
          })}
        </div>

        {paso === 1 && (
          <section className="wpaso" data-activo="1">
            <div className="wtit">
              <h2>El evento</h2>
              <p>Con el nombre alcanza para empezar. El resto lo podés completar después.</p>
            </div>

            <div className="card">
              <div className="blq-b">
                <div className="campo">
                  <label htmlFor="nom">Nombre</label>
                  <input
                    className="inp"
                    id="nom"
                    autoFocus
                    placeholder="Duatlón Club Ciclista Chivilcoy"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    onBlur={() => setTocado(true)}
                  />
                  {tocado && !nombreOk && (
                    <div className="pista" style={{ color: "var(--bad)" }}>
                      Poné un nombre de al menos 3 letras.
                    </div>
                  )}
                </div>

                <div className="par">
                  <div className="campo">
                    <label htmlFor="fecha">Fecha</label>
                    <Fecha id="fecha" valor={fecha || null} alCambiar={(v) => setFecha(v ?? "")} />
                  </div>
                  <div className="campo">
                    <label htmlFor="lugar">Lugar</label>
                    <input
                      className="inp"
                      id="lugar"
                      placeholder="Chivilcoy, Buenos Aires"
                      value={lugar}
                      onChange={(e) => setLugar(e.target.value)}
                    />
                  </div>
                </div>

                <div className="campo">
                  <label htmlFor="disc">Disciplina</label>
                  <Desplegable
                    id="disc"
                    opciones={DISCIPLINAS.map((d) => ({ valor: d, texto: d }))}
                    valor={disciplina}
                    alCambiar={setDisciplina}
                  />
                </div>

                <div className="campo">
                  <label>Portada</label>
                  <div
                    className="cover"
                    role="button"
                    tabIndex={0}
                    style={
                      previaPortada
                        ? {
                            backgroundImage: `url(${previaPortada})`,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                          }
                        : undefined
                    }
                    onClick={() => archivo.current?.click()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        archivo.current?.click();
                      }
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      elegirPortada(e.dataTransfer.files[0]);
                    }}
                  >
                    <input
                      ref={archivo}
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={(e) => {
                        elegirPortada(e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                    {!previaPortada && (
                      <>
                        <ImagenIcono />
                        <span>Arrastrá una foto o hacé click</span>
                      </>
                    )}
                    {previaPortada && (
                      <button
                        type="button"
                        className="quitar"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPortada(null);
                        }}
                      >
                        <X /> Quitar
                      </button>
                    )}
                  </div>
                  {errorPortada && (
                    <div className="pista" style={{ color: "var(--bad)" }}>
                      {errorPortada}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {paso === 2 && (
          <section className="wpaso" data-activo="1">
            <div className="wtit">
              <h2>Cómo se encuentran las fotos</h2>
              <p>
                Esto define lo que te cobramos. Se puede cambiar después, pero conviene decidirlo
                antes de subir.
              </p>
            </div>

            <div className="opciones">
              <label className="op">
                <input
                  type="radio"
                  name="rec"
                  checked={reconocimiento}
                  onChange={() => setReconocimiento(true)}
                />
                <span className="op-caja">
                  <span className="op-top">
                    <span className="op-i">
                      <ScanFace />
                    </span>
                    <span className="op-com">
                      <b>{COMISION_CON}%</b>
                      <span>Comisión</span>
                    </span>
                  </span>
                  <h3>Con reconocimiento</h3>
                  <p>El atleta se saca una selfie o pone su dorsal y encuentra sus fotos en segundos.</p>
                  <ul className="op-lista">
                    <li>
                      <Check /> Búsqueda por cara
                    </li>
                    <li>
                      <Check /> Búsqueda por dorsal
                    </li>
                    <li>
                      <Check /> Marca de agua en las muestras
                    </li>
                  </ul>
                </span>
              </label>

              <label className="op">
                <input
                  type="radio"
                  name="rec"
                  checked={!reconocimiento}
                  onChange={() => setReconocimiento(false)}
                />
                <span className="op-caja">
                  <span className="op-top">
                    <span className="op-i">
                      <Images />
                    </span>
                    <span className="op-com">
                      <b>{COMISION_SIN}%</b>
                      <span>Comisión</span>
                    </span>
                  </span>
                  <h3>Galería simple</h3>
                  <p>El atleta busca sus fotos mirando la galería, como en cualquier álbum web.</p>
                  <ul className="op-lista">
                    <li className="no">
                      <X /> Sin búsqueda por cara
                    </li>
                    <li className="no">
                      <X /> Sin búsqueda por dorsal
                    </li>
                    <li>
                      <Check /> Marca de agua en las muestras
                    </li>
                  </ul>
                </span>
              </label>
            </div>

            {/* Sin esto, el 10% se lee como castigo y no como lo que es. */}
            <div className="porque">
              <Info />
              <span>
                <b>La diferencia es el costo del reconocimiento.</b> Cada foto que subís se procesa
                una por una para detectar caras y dorsales, y eso lo pagamos nosotros. Si no lo usás,
                no lo pagás.
              </span>
            </div>
          </section>
        )}

        {paso === 3 && (
          <section className="wpaso" data-activo="1">
            <div className="wtit">
              <h2>Precio</h2>
              <p>Podés cambiarlo cuando quieras, incluso con el evento publicado.</p>
            </div>

            <div className="card blq">
              <h2>Cuánto sale cada foto</h2>
              {/* El precio de UNA foto, que es la unidad que compra el atleta.
                  Sin decirlo, se confunde con el precio de la galería entera y
                  el número que se pone termina siendo diez veces el que va. */}
              <p className="ayuda">
                Es lo que paga el atleta por cada foto suya que se lleva. La mayoría arranca entre
                $1.500 y $2.500.
              </p>
              <div className="blq-b">
                <div className="campo">
                  <label htmlFor="p1">Una foto</label>
                  <div className="pegado">
                    <span className="fijo">$</span>
                    <input
                      ref={campoPrecio}
                      className="inp tnum"
                      id="p1"
                      inputMode="numeric"
                      value={conPuntos(precio)}
                      onChange={(e) => {
                        const el = e.target;
                        const antes = el.value
                          .slice(0, el.selectionStart ?? 0)
                          .replace(/\D/g, "").length;
                        const limpio = el.value.replace(/\D/g, "").slice(0, 8);
                        setPrecio(limpio);

                        const puesto = conPuntos(limpio);
                        let pos = puesto.length;
                        for (let i = 0, d = 0; i < puesto.length; i++) {
                          if (/\d/.test(puesto[i]!)) d++;
                          if (d === antes) {
                            pos = i + 1;
                            break;
                          }
                        }
                        requestAnimationFrame(() =>
                          campoPrecio.current?.setSelectionRange(pos, pos),
                        );
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* La comisión traducida a la unidad en la que el fotógrafo piensa:
                cuánto le queda de cada foto vendida. */}
            <div className="queda">
              <div className="queda-t">
                <span>De cada foto te quedan</span>
                <b className="tnum">${neto.toLocaleString("es-AR")}</b>
              </div>
              <div className="queda-d">
                Precio <b className="tnum">${precioOk ? n.toLocaleString("es-AR") : "—"}</b>
                <br />
                Comisión <b className="tnum">{comision}%</b> ·{" "}
                <b className="tnum">${fee.toLocaleString("es-AR")}</b>
              </div>
            </div>
          </section>
        )}

        <div style={{ display: "flex", gap: "var(--s-2)", marginTop: "var(--s-5)" }}>
          {paso > 1 && (
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => setPaso(paso - 1)}
              disabled={enviando}
            >
              <ArrowLeft /> Atrás
            </button>
          )}
          <div style={{ flex: 1 }} />
          {error && <span style={{ color: "var(--bad)", fontSize: 13, alignSelf: "center" }}>{error}</span>}
          <button className="btn btn-pri btn-lg" type="button" onClick={seguir} disabled={enviando}>
            {enviando ? "Creando" : paso === 3 ? "Crear evento" : "Seguir"}
            {!enviando && <ArrowRight className="go" />}
          </button>
        </div>
      </div>

      <aside className="lado">
        <div className="card">
          <div className="card-h">
            <div>
              <h2>Así se va a ver</h2>
            </div>
          </div>
          <div className="previa-ev">
            <div
              className="previa-cv"
              style={
                previaPortada
                  ? {
                      backgroundImage: `url(${previaPortada})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }
                  : undefined
              }
            >
              {!previaPortada && <ImagenIcono />}
            </div>
            <div className="previa-b">
              <b>{nombre.trim() || "Tu evento"}</b>
              <span>
                {fecha
                  ? new Date(`${fecha}T12:00:00`).toLocaleDateString("es-AR", {
                      day: "numeric",
                      month: "long",
                    })
                  : "Sin fecha"}
                {lugar.trim() && ` · ${lugar.trim()}`}
              </span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-h">
            <div>
              <h2>Resumen</h2>
            </div>
          </div>
          <dl className="resumen">
            <div className="rs">
              <dt>Fecha</dt>
              <dd className={fecha ? undefined : "pendiente"}>
                {fecha
                  ? new Date(`${fecha}T12:00:00`).toLocaleDateString("es-AR", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })
                  : "—"}
              </dd>
            </div>
            <div className="rs">
              <dt>Disciplina</dt>
              <dd className={disciplina ? undefined : "pendiente"}>{disciplina || "—"}</dd>
            </div>
            <div className="rs">
              <dt>Búsqueda</dt>
              <dd>{reconocimiento ? "Por cara y dorsal" : "Mirando la galería"}</dd>
            </div>
            <div className="rs">
              <dt>Comisión</dt>
              <dd>{comision}%</dd>
            </div>
            <div className="rs">
              <dt>Una foto</dt>
              <dd>${precioOk ? n.toLocaleString("es-AR") : "—"}</dd>
            </div>
          </dl>
        </div>
      </aside>
    </div>
  );
}
