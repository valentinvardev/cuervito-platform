"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Download, ImageOff, Lock, Move } from "lucide-react";

import {
  cajaFoto,
  FORMATOS,
  FORMATOS_LISTA,
  PLANTILLAS_LISTA,
  type Foco,
  type FormatoId,
  type PlantillaId,
} from "~/server/historias/formatos";

import { Armando } from "../_components/armando";
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
 *
 * La única excepción es el encuadre. Mientras se arrastra la foto, se muestra
 * la foto sola —sin texto— con la misma regla de recorte que usa el servidor
 * (`object-fit: cover` + `object-position`), y al soltar se pide el render
 * con ese punto. No es un segundo maquetador: es la misma foto con la misma
 * regla, y el texto vuelve un segundo después, donde siempre estuvo.
 */
export function Estudio({ eventos }: { eventos: EventoOp[] }) {
  const [eventoId, setEventoId] = useState(eventos[0]?.id ?? "");
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [fotoId, setFotoId] = useState<string | null>(null);
  const [plantilla, setPlantilla] = useState<PlantillaId>("cubierta");
  const [formato, setFormato] = useState<FormatoId>("historia");

  // El encuadre. `foco` es el que se manda al servidor: null es "que lo
  // decida sharp". `focoAuto` es dónde lo dejó sharp la última vez (viene en
  // la respuesta), para que el arrastre arranque de ahí. `focoVivo` es el que
  // se está viendo mientras se arrastra.
  const [foco, setFoco] = useState<Foco | null>(null);
  const [focoAuto, setFocoAuto] = useState<Foco | null>(null);
  const [focoVivo, setFocoVivo] = useState<Foco | null>(null);
  const [arrastrando, setArrastrando] = useState(false);
  // La capa con la foto sola queda visible desde que se empieza a arrastrar
  // hasta que llega el render nuevo: si se apagara al soltar, la foto pegaría
  // un salto a la posición vieja y volvería un segundo después.
  const [capa, setCapa] = useState(false);
  // Soltar es fijar, y tiene que verse: "fijando" desde que se suelta hasta
  // que llega el render con ese punto, "fijado" un par de segundos después,
  // y el borde parpadea una vez al soltar. Sin esto, soltar no hace nada
  // visible hasta que aparece la pieza nueva, y parece que no tomó.
  const [fijado, setFijado] = useState<"no" | "fijando" | "fijado">("no");
  const [parpadeo, setParpadeo] = useState(false);
  const esperandoFijar = useRef(false);
  const timerFijado = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [salida, setSalida] = useState<string | null>(null);
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Para descartar respuestas viejas: cambiar de foto dos veces rápido puede
  // hacer que la primera llegue segunda y pise a la que se está mirando.
  const turno = useRef(0);
  // El blob anterior se revoca a mano; si no, cada render deja una copia de la
  // imagen viva en memoria hasta que se cierra la pestaña.
  const blobAnterior = useRef<string | null>(null);
  const lienzoRef = useRef<HTMLDivElement>(null);
  const fotoSolaRef = useRef<HTMLImageElement>(null);
  const arrastre = useRef<{
    px: number;
    py: number;
    foco: Foco;
    rangoX: number;
    rangoY: number;
  } | null>(null);

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

  // Otra foto, otro encuadre: el punto que servía para una no dice nada de la
  // siguiente.
  useEffect(() => {
    setFoco(null);
    setFocoAuto(null);
    setFocoVivo(null);
    setFijado("no");
    esperandoFijar.current = false;
  }, [fotoId]);

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
        body: JSON.stringify({ photoId: fotoId, plantilla, formato, ...(foco ? { foco } : {}) }),
      });
      if (turno.current !== mio) return;
      if (!r.ok) {
        const d = (await r.json().catch(() => null)) as { error?: string } | null;
        setError(d?.error ?? "No pudimos armar la historia.");
        return;
      }
      const usado = r.headers.get("x-foco")?.split(",").map(Number);
      if (usado?.length === 2 && usado.every((n) => Number.isFinite(n))) {
        setFocoAuto({ x: usado[0]!, y: usado[1]! });
      }
      const url = URL.createObjectURL(await r.blob());
      if (turno.current !== mio) {
        URL.revokeObjectURL(url);
        return;
      }
      if (blobAnterior.current) URL.revokeObjectURL(blobAnterior.current);
      blobAnterior.current = url;
      setSalida(url);
      // Llegó la pieza con el encuadre que se soltó: ahora sí está fijado.
      if (esperandoFijar.current) {
        esperandoFijar.current = false;
        setFijado("fijado");
        if (timerFijado.current) clearTimeout(timerFijado.current);
        timerFijado.current = setTimeout(() => setFijado("no"), 2400);
      }
    } catch {
      if (turno.current === mio) setError("No pudimos armar la historia.");
    } finally {
      if (turno.current === mio) {
        setGenerando(false);
        setCapa(false);
      }
    }
  }, [fotoId, plantilla, formato, foco]);

  // Se regenera solo con cada cambio. Es un pedido al servidor por click y
  // evita el botón "Generar" que obliga a confirmar cada prueba.
  useEffect(() => {
    void generar();
  }, [generar]);

  useEffect(() => {
    return () => {
      if (blobAnterior.current) URL.revokeObjectURL(blobAnterior.current);
      if (timerFijado.current) clearTimeout(timerFijado.current);
    };
  }, []);

  // ── El arrastre ───────────────────────────────────────────────────────────
  const f = FORMATOS[formato];
  const caja = cajaFoto(plantilla, formato);
  const evento = eventos.find((e) => e.id === eventoId);
  const fotoSel = fotos.find((x) => x.id === fotoId) ?? null;

  function empezarArrastre(e: React.PointerEvent<HTMLDivElement>) {
    const lienzo = lienzoRef.current;
    const img = fotoSolaRef.current;
    if (!lienzo || !img?.naturalWidth || !salida) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);

    // Cuánto sobra de foto a cada lado, en píxeles de pantalla. Es lo que
    // convierte un desplazamiento del puntero en una fracción del encuadre:
    // arrastrar todo el sobrante mueve el foco de 0 a 1.
    const k = lienzo.getBoundingClientRect().width / f.ancho;
    const bw = caja.ancho * k;
    const bh = caja.alto * k;
    const esc = Math.max(bw / img.naturalWidth, bh / img.naturalHeight);
    const inicial = focoVivo ?? foco ?? focoAuto ?? { x: 0.5, y: 0.5 };
    arrastre.current = {
      px: e.clientX,
      py: e.clientY,
      foco: inicial,
      rangoX: img.naturalWidth * esc - bw,
      rangoY: img.naturalHeight * esc - bh,
    };
    setFocoVivo(inicial);
    setArrastrando(true);
    setCapa(true);
  }

  function moverArrastre(e: React.PointerEvent<HTMLDivElement>) {
    const a = arrastre.current;
    if (!a) return;
    const acotar = (n: number) => Math.min(1, Math.max(0, n));
    // Arrastrar la foto a la derecha muestra más de su lado izquierdo: el
    // foco baja. Por eso el signo.
    setFocoVivo({
      x: a.rangoX > 1 ? acotar(a.foco.x - (e.clientX - a.px) / a.rangoX) : a.foco.x,
      y: a.rangoY > 1 ? acotar(a.foco.y - (e.clientY - a.py) / a.rangoY) : a.foco.y,
    });
  }

  function soltarArrastre() {
    if (!arrastre.current) return;
    arrastre.current = null;
    setArrastrando(false);
    // Soltar es pedir el render con ese punto. Si no se movió nada, `foco`
    // no cambia, no se pide nada y no hay nada que fijar.
    const cambio = !!focoVivo && !(foco?.x === focoVivo.x && foco?.y === focoVivo.y);
    if (!cambio) {
      setCapa(false);
      return;
    }
    setFoco(focoVivo);
    esperandoFijar.current = true;
    setFijado("fijando");
    setParpadeo(true);
    setTimeout(() => setParpadeo(false), 750);
  }

  /** Volver a dejar que sharp elija el encuadre. */
  function volverAutomatico() {
    esperandoFijar.current = false;
    setFoco(null);
    setFocoVivo(null);
    setFijado("no");
  }

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

  const pct = (n: number) => `${(n * 100).toFixed(3)}%`;
  const fv = focoVivo ?? foco ?? focoAuto ?? { x: 0.5, y: 0.5 };

  return (
    <div className="hist">
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
            <span>
              {f.ancho} × {f.alto}
            </span>
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
          ref={lienzoRef}
          className="hist-lienzo"
          data-cargando={generando && !capa ? "1" : undefined}
          data-arr={arrastrando ? "1" : undefined}
          style={{ ["--pv" as string]: `${f.ancho} / ${f.alto}` }}
        >
          {salida ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={salida} alt="Vista previa de la historia" />
          ) : generando ? (
            <Armando />
          ) : (
            <div className="hist-vacio">{error ?? "Elegí una foto para empezar."}</div>
          )}

          {/* Mientras se rerenderiza queda la anterior atenuada y el loader
              encima. Después de arrastrar no: ahí lo que se ve es la foto
              sola en la posición nueva, y taparla sería esconder justo lo
              que se acaba de elegir; el aviso de abajo dice que se está
              actualizando. */}
          {salida && generando && !capa && <Armando titulo="Armando la pieza" sobre />}

          {/* La zona que se arrastra: exactamente donde está la foto en la
              pieza. Adentro va la foto sola, que sólo se ve mientras la capa
              está prendida; el resto del tiempo es transparente y sirve para
              que el puntero tenga dónde agarrar. */}
          {fotoSel && salida && (
            <div
              className="hist-arr"
              data-viva={capa ? "1" : undefined}
              data-fijado={parpadeo ? "1" : undefined}
              style={{
                left: pct(caja.left / f.ancho),
                top: pct(caja.top / f.alto),
                width: pct(caja.ancho / f.ancho),
                height: pct(caja.alto / f.alto),
                borderRadius: caja.radio
                  ? `${(caja.radio / f.ancho) * (lienzoRef.current?.clientWidth ?? 340)}px`
                  : 0,
              }}
              onPointerDown={empezarArrastre}
              onPointerMove={moverArrastre}
              onPointerUp={soltarArrastre}
              onPointerCancel={soltarArrastre}
              role="presentation"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={fotoSolaRef}
                src={fotoSel.url}
                alt=""
                draggable={false}
                style={{ objectPosition: `${pct(fv.x)} ${pct(fv.y)}` }}
              />
            </div>
          )}

          {/* El aviso de abajo, en cuatro momentos: qué hacer, qué hace
              soltar, que se está fijando, y que quedó fijado. */}
          {fotoSel && salida && arrastrando && (
            <div className="hist-pista" data-tipo="soltar" aria-hidden="true">
              <Move />
              Soltá para fijar el encuadre
            </div>
          )}
          {fotoSel && salida && !arrastrando && fijado === "fijando" && (
            <div className="hist-pista" role="status">
              <span className="armando-anillo" aria-hidden="true" />
              Fijando el encuadre…
            </div>
          )}
          {fotoSel && salida && !arrastrando && fijado === "fijado" && (
            <div className="hist-pista" data-tipo="ok" role="status">
              <Check />
              Encuadre fijado
            </div>
          )}
          {fotoSel && salida && !arrastrando && !generando && fijado === "no" && (
            <div className="hist-pista" aria-hidden="true">
              <Move />
              {foco ? "Arrastrá para ajustar el encuadre" : "Arrastrá la foto para encuadrarla"}
            </div>
          )}

          {/* Mientras haya un encuadre a mano, se dice, y se puede volver al
              automático. Va después de la zona de arrastre para quedar
              encima y que el botón reciba el click. */}
          {fotoSel && salida && foco && !arrastrando && (
            <div className="hist-chip">
              <Lock />
              Encuadre manual
              <button type="button" onClick={volverAutomatico} disabled={generando}>
                Automático
              </button>
            </div>
          )}
        </div>

        {error && salida && (
          <div className="hist-vacio" style={{ padding: 0 }}>
            {error}
          </div>
        )}

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
  );
}
