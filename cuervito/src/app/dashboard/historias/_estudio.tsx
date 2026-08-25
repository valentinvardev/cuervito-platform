"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, FlaskConical, ImageOff } from "lucide-react";

import {
  FORMATOS,
  FORMATOS_LISTA,
  PLANTILLAS_LISTA,
  type FormatoId,
  type PlantillaId,
} from "~/server/historias/formatos";

import { Desplegable } from "../_components/desplegable";

type EventoOp = { id: string; nombre: string; fecha: string | null; fotos: number };
type Foto = { id: string; url: string };

/**
 * Elegir evento, foto y formato; ver el resultado.
 *
 * Se re-renderiza en el servidor con cada cambio y no se arma nada en el
 * navegador. Podría dibujarse una aproximación con CSS y sería instantánea,
 * pero entonces habría dos maquetadores para la misma pieza y lo que se ve al
 * decidir no sería lo que se baja. Acá lo único que importa es si el título
 * tapa la cara, y eso sólo lo contesta la imagen de verdad.
 */
export function Estudio({ eventos }: { eventos: EventoOp[] }) {
  const [eventoId, setEventoId] = useState(eventos[0]?.id ?? "");
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [fotoId, setFotoId] = useState<string | null>(null);
  const [plantilla, setPlantilla] = useState<PlantillaId>("cubierta");
  const [formato, setFormato] = useState<FormatoId>("historia");

  const [salida, setSalida] = useState<string | null>(null);
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Para descartar respuestas viejas: cambiar de foto dos veces rápido puede
  // hacer que la primera llegue segunda y pise a la que se está mirando.
  const turno = useRef(0);
  // El blob anterior se revoca a mano; si no, cada render deja una copia de la
  // imagen viva en memoria hasta que se cierra la pestaña.
  const blobAnterior = useRef<string | null>(null);

  // ── Las fotos del evento elegido ──────────────────────────────────────────
  useEffect(() => {
    if (!eventoId) return;
    let vigente = true;
    setFotos([]);
    setFotoId(null);
    void (async () => {
      try {
        const r = await fetch(`/api/dashboard/historias/fotos?eventId=${eventoId}`);
        if (!r.ok || !vigente) return;
        const d = (await r.json()) as { fotos: Foto[] };
        if (!vigente) return;
        setFotos(d.fotos);
        // La más nueva viene primera y es la que uno quiere el 90% de las
        // veces: es el evento que acaba de cubrir.
        setFotoId(d.fotos[0]?.id ?? null);
      } catch {
        if (vigente) setError("No pudimos traer las fotos del evento.");
      }
    })();
    return () => {
      vigente = false;
    };
  }, [eventoId]);

  // ── El render ─────────────────────────────────────────────────────────────
  const generar = useCallback(async () => {
    if (!fotoId) return;
    const mio = ++turno.current;
    setGenerando(true);
    setError(null);
    try {
      const r = await fetch("/api/dashboard/historias", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ photoId: fotoId, plantilla, formato }),
      });
      if (turno.current !== mio) return;
      if (!r.ok) {
        const d = (await r.json().catch(() => null)) as { error?: string } | null;
        setError(d?.error ?? "No pudimos armar la historia.");
        return;
      }
      const url = URL.createObjectURL(await r.blob());
      if (turno.current !== mio) {
        URL.revokeObjectURL(url);
        return;
      }
      if (blobAnterior.current) URL.revokeObjectURL(blobAnterior.current);
      blobAnterior.current = url;
      setSalida(url);
    } catch {
      if (turno.current === mio) setError("No pudimos armar la historia.");
    } finally {
      if (turno.current === mio) setGenerando(false);
    }
  }, [fotoId, plantilla, formato]);

  // Se regenera solo con cada cambio. Es un pedido al servidor por click, que
  // en una beta de tres personas no es nada, y evita el botón "Generar" que
  // obliga a confirmar cada prueba.
  useEffect(() => {
    void generar();
  }, [generar]);

  useEffect(() => {
    return () => {
      if (blobAnterior.current) URL.revokeObjectURL(blobAnterior.current);
    };
  }, []);

  const f = FORMATOS[formato];
  const evento = eventos.find((e) => e.id === eventoId);

  if (eventos.length === 0) {
    return (
      <div className="empty">
        <div className="empty-i">
          <ImageOff />
        </div>
        <h3>Todavía no hay fotos para usar</h3>
        <p>Cuando subas fotos a un evento y terminen de procesarse, van a aparecer acá.</p>
      </div>
    );
  }

  return (
    <>
      <div className="hist-beta">
        <FlaskConical />
        <span>
          Esto es una prueba interna. Las piezas se arman con el color y el logo de tu página, y
          la foto sale tal cual, sin retoques.
        </span>
      </div>

      <div className="hist" style={{ marginTop: "var(--s-4)" }}>
        <div className="hist-op">
          <div className="card">
            <div className="hist-tit">
              <b>Evento</b>
              {evento && <span>{evento.fotos.toLocaleString("es-AR")} fotos</span>}
            </div>
            <Desplegable
              opciones={eventos.map((e) => ({
                valor: e.id,
                texto: e.fecha ? `${e.nombre} · ${e.fecha}` : e.nombre,
              }))}
              valor={eventoId}
              alCambiar={setEventoId}
            />
          </div>

          <div className="card">
            <div className="hist-tit">
              <b>Formato</b>
              <span>{f.ancho} × {f.alto}</span>
            </div>
            <div className="hist-ops">
              {FORMATOS_LISTA.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className="hist-o"
                  aria-pressed={formato === o.id}
                  onClick={() => setFormato(o.id)}
                >
                  <b>{o.nombre}</b>
                  <span>{o.donde}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="hist-tit">
              <b>Diseño</b>
            </div>
            <div className="hist-ops">
              {PLANTILLAS_LISTA.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className="hist-o"
                  aria-pressed={plantilla === o.id}
                  onClick={() => setPlantilla(o.id)}
                >
                  <b>{o.nombre}</b>
                  <span>{o.descripcion}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="hist-tit">
              <b>Foto</b>
              <span>La que mejor cuente el evento</span>
            </div>
            {fotos.length === 0 ? (
              <div className="hist-vacio">Buscando las fotos del evento…</div>
            ) : (
              <div className="fg hist-fg">
                {fotos.map((x) => (
                  <button
                    key={x.id}
                    type="button"
                    className="ft"
                    data-sel={fotoId === x.id ? "1" : undefined}
                    onClick={() => setFotoId(x.id)}
                    aria-label="Usar esta foto"
                    aria-pressed={fotoId === x.id}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={x.url} alt="" loading="lazy" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="hist-pv">
          <div
            className="hist-lienzo"
            data-cargando={generando ? "1" : undefined}
            style={{ ["--pv" as string]: `${f.ancho} / ${f.alto}` }}
          >
            {salida ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={salida} alt="Vista previa de la historia" />
            ) : (
              <div className="hist-vacio">
                {error ?? (generando ? "Armando la pieza…" : "Elegí una foto para empezar.")}
              </div>
            )}
          </div>

          {error && salida && <div className="hist-vacio" style={{ padding: 0 }}>{error}</div>}

          <div className="hist-acc">
            <a
              className="btn btn-pri btn-block"
              href={salida ?? "#"}
              download={`${formato}-${evento?.nombre ?? "encontrate"}.jpg`}
              aria-disabled={!salida || generando}
              // Sin imagen el link no lleva a ningún lado, así que se apaga de
              // verdad y no sólo visualmente.
              onClick={(e) => {
                if (!salida || generando) e.preventDefault();
              }}
              style={!salida || generando ? { opacity: 0.5, pointerEvents: "none" } : undefined}
            >
              <Download /> Descargar
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
