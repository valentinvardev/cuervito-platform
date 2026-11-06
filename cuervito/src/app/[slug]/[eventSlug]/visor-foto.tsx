"use client";

import { Check, ChevronLeft, ChevronRight, Minus, Plus, ShoppingCart, X, ZoomIn } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * El visor de la tienda: una foto en grande, con el botón de comprar al lado.
 *
 * Es UNO para las tres plantillas y los tres tamaños de pantalla. Antes había
 * dos —public-lightbox para feed y cobertura, visor para encontrate— con dos
 * reglas de tamaño distintas, y el primero mostraba la miniatura de 560 que
 * dibuja la grilla: en un iPad o una PC quedaba chica y «no llegaba al borde».
 *
 * Tres bandas. Arriba, el evento y cerrar. En el medio el escenario: mide lo
 * mismo para todas las fotos del dispositivo y la foto entra con
 * object-fit: contain, así cambia la foto y nunca el marco ni los botones.
 * Abajo, el dorsal, el zoom y la compra. Nada se dibuja sobre la foto: el
 * zoom —rueda, doble clic o pellizco— no puede pisar un botón.
 *
 * El botón de agregar va acá y no sólo en la grilla porque acá es donde se
 * decide: uno abre la foto justamente para mirarla de cerca antes de pagarla.
 *
 * Siempre la vista previa de 2400 (fullUrl). La miniatura, si viene, ocupa el
 * lugar exacto mientras llega la grande, para que el cambio de foto no
 * muestre nunca un hueco.
 */
export type FotoVisor = {
  id: string;
  /** La de 2400: la única que se muestra en grande. */
  fullUrl: string;
  /** La miniatura, si la grilla ya la tiene: tapa el hueco mientras carga la grande. */
  previewUrl?: string;
  bibNumbers: string | null;
  width?: number | null;
  height?: number | null;
};

type Vista = { s: number; x: number; y: number };
const QUIETA: Vista = { s: 1, x: 0, y: 0 };

const ZOOM_MAX = 4;
const ZOOM_DOBLE = 2.5;
const PASO = 1.5;
/** Radio de la lupa, en píxeles. */
const LUPA = 120;
/** Lo que dura la animación de salida en el CSS. */
const SALIDA_MS = 150;
/** Cuánto hay que deslizar, sin zoom, para pasar de foto. */
const UMBRAL_DESLIZ = 50;

type Gesto =
  | { tipo: "arrastre"; x0: number; y0: number; v0: Vista }
  | { tipo: "pinza"; d0: number; m0: { x: number; y: number }; v0: Vista };

const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));

export function VisorFoto({
  fotos,
  indice,
  evento,
  precio,
  enCarrito,
  alAlternar,
  alIr,
  alCerrar,
  barrido = false,
}: {
  fotos: FotoVisor[];
  indice: number;
  /** El nombre del evento, para la banda de arriba. */
  evento: string;
  /** Ya formateado: «$3.500» o «Gratis». */
  precio: string;
  enCarrito: (id: string) => boolean;
  alAlternar: (f: FotoVisor) => void;
  alIr: (i: number) => void;
  alCerrar: () => void;
  /** Opción del fotógrafo: la foto borrosa y una banda diagonal nítida que la recorre. */
  barrido?: boolean;
}) {
  const foto = fotos[indice];
  const total = fotos.length;

  const [montado, setMontado] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const [vista, setVista] = useState<Vista>(QUIETA);
  const [cargada, setCargada] = useState(false);
  const [caja, setCaja] = useState({ w: 0, h: 0 });
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [lupa, setLupa] = useState<{ x: number; y: number } | null>(null);
  const [conMouse, setConMouse] = useState(false);
  const [yaAcerco, setYaAcerco] = useState(false);

  const marcoRef = useRef<HTMLDivElement | null>(null);
  const punteros = useRef(new Map<number, { x: number; y: number }>());
  const gesto = useRef<Gesto | null>(null);
  const ultimoToque = useRef<{ t: number; x: number; y: number } | null>(null);
  const ultimoTipo = useRef<string>("mouse");

  useEffect(() => setMontado(true), []);

  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    setConMouse(mq.matches);
    const al = (e: MediaQueryListEvent) => setConMouse(e.matches);
    mq.addEventListener("change", al);
    return () => mq.removeEventListener("change", al);
  }, []);

  // El escenario mide lo mismo para todas las fotos; lo que cambia es la foto.
  useEffect(() => {
    const el = marcoRef.current;
    if (!el) return;
    const medir = () => setCaja({ w: el.clientWidth, h: el.clientHeight });
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [montado]);

  // Dónde queda dibujada la foto adentro del escenario, sin zoom.
  const prop = nat ?? (foto?.width && foto?.height ? { w: foto.width, h: foto.height } : { w: 3, h: 2 });
  const k = caja.w && caja.h ? Math.min(caja.w / prop.w, caja.h / prop.h) : 0;
  const rect = { rw: prop.w * k, rh: prop.h * k, ox: (caja.w - prop.w * k) / 2, oy: (caja.h - prop.h * k) / 2 };
  const rectRef = useRef(rect);
  rectRef.current = rect;
  const cajaRef = useRef(caja);
  cajaRef.current = caja;

  /** La vista, dentro de lo permitido: nunca más chica que el marco ni corrida de más. */
  const ajustar = useCallback((v: Vista): Vista => {
    if (v.s <= 1.02) return QUIETA;
    const s = clamp(v.s, 1, ZOOM_MAX);
    const { rw, rh } = rectRef.current;
    const { w, h } = cajaRef.current;
    const maxX = Math.max(0, (rw * s - w) / 2);
    const maxY = Math.max(0, (rh * s - h) / 2);
    return { s, x: clamp(v.x, -maxX, maxX), y: clamp(v.y, -maxY, maxY) };
  }, []);

  /** Acerca o aleja dejando quieto lo que hay bajo el punto p (en píxeles del marco). */
  const enfocar = useCallback(
    (p: { x: number; y: number }, sNuevo: number, v: Vista): Vista => {
      const c = { x: cajaRef.current.w / 2, y: cajaRef.current.h / 2 };
      const s = clamp(sNuevo, 1, ZOOM_MAX);
      return ajustar({
        s,
        x: p.x - c.x - ((p.x - c.x - v.x) * s) / v.s,
        y: p.y - c.y - ((p.y - c.y - v.y) * s) / v.s,
      });
    },
    [ajustar],
  );

  const ir = useCallback(
    (i: number) => {
      if (i < 0 || i >= total) return;
      setVista(QUIETA);
      setCargada(false);
      setNat(null);
      setLupa(null);
      alIr(i);
    },
    [total, alIr],
  );

  const cerrar = useCallback(() => {
    setCerrando(true);
    setTimeout(alCerrar, SALIDA_MS);
  }, [alCerrar]);

  useEffect(() => {
    const alTecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrar();
      else if (e.key === "ArrowLeft") ir(indice - 1);
      else if (e.key === "ArrowRight") ir(indice + 1);
      else if (e.key === "+" || e.key === "=") setVista((v) => enfocar(centro(), v.s * PASO, v));
      else if (e.key === "-") setVista((v) => enfocar(centro(), v.s / PASO, v));
      else if (e.key === "0") setVista(QUIETA);
    };
    const centro = () => ({ x: cajaRef.current.w / 2, y: cajaRef.current.h / 2 });
    window.addEventListener("keydown", alTecla);
    return () => window.removeEventListener("keydown", alTecla);
  }, [indice, ir, cerrar, enfocar]);

  useEffect(() => {
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = antes;
    };
  }, []);

  // La anterior y la siguiente, ya pedidas: pasar de foto no muestra un hueco.
  useEffect(() => {
    for (const f of [fotos[indice - 1], fotos[indice + 1]]) {
      if (!f) continue;
      const img = new Image();
      img.src = f.fullUrl;
    }
  }, [indice, fotos]);

  // La rueda, con un listener propio: React la registra pasiva y no deja
  // frenar el scroll de la página de atrás.
  useEffect(() => {
    const el = marcoRef.current;
    if (!el) return;
    const alRueda = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const p = { x: e.clientX - r.left, y: e.clientY - r.top };
      const f = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0015));
      setVista((v) => enfocar(p, v.s * f, v));
      setLupa(null);
      setYaAcerco(true);
    };
    el.addEventListener("wheel", alRueda, { passive: false });
    return () => el.removeEventListener("wheel", alRueda);
  }, [montado, enfocar]);

  if (!foto || !montado) return null;

  const local = (e: { clientX: number; clientY: number }) => {
    const r = marcoRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
  const medio = (a: { x: number; y: number }, b: { x: number; y: number }) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

  /** La lupa sigue al mouse mientras está sobre la foto y no hay zoom. */
  function moverLupa(p: { x: number; y: number }) {
    const { ox, oy, rw, rh } = rectRef.current;
    const adentro = p.x >= ox && p.x <= ox + rw && p.y >= oy && p.y <= oy + rh;
    setLupa(adentro ? p : null);
  }

  function alternarZoom(p: { x: number; y: number }) {
    setVista((v) => (v.s > 1 ? QUIETA : enfocar(p, ZOOM_DOBLE, v)));
    setLupa(null);
    setYaAcerco(true);
  }

  function alBajar(e: React.PointerEvent<HTMLDivElement>) {
    // Algún navegador tira si el puntero ya se soltó; sin captura igual anda.
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    const p = local(e);
    punteros.current.set(e.pointerId, p);
    ultimoTipo.current = e.pointerType;
    if (punteros.current.size === 2) {
      const [a, b] = [...punteros.current.values()] as [{ x: number; y: number }, { x: number; y: number }];
      gesto.current = { tipo: "pinza", d0: Math.max(1, dist(a, b)), m0: medio(a, b), v0: vista };
      setLupa(null);
      return;
    }
    if (e.pointerType !== "mouse") {
      // Doble toque: dos toques cerca, en menos de 300 ms.
      const ahora = Date.now();
      const u = ultimoToque.current;
      if (u && ahora - u.t < 300 && dist(u, p) < 30) {
        ultimoToque.current = null;
        gesto.current = null;
        alternarZoom(p);
        return;
      }
      ultimoToque.current = { t: ahora, ...p };
    }
    gesto.current = { tipo: "arrastre", x0: p.x, y0: p.y, v0: vista };
  }

  function alMover(e: React.PointerEvent<HTMLDivElement>) {
    const p = local(e);
    if (!punteros.current.has(e.pointerId)) {
      // El mouse pasando por encima, sin apretar.
      if (e.pointerType === "mouse" && vista.s === 1) moverLupa(p);
      return;
    }
    punteros.current.set(e.pointerId, p);
    const g = gesto.current;
    if (g?.tipo === "pinza" && punteros.current.size >= 2) {
      const [a, b] = [...punteros.current.values()] as [{ x: number; y: number }, { x: number; y: number }];
      const s = clamp((g.v0.s * dist(a, b)) / g.d0, 1, ZOOM_MAX);
      const m = medio(a, b);
      const c = { x: cajaRef.current.w / 2, y: cajaRef.current.h / 2 };
      setVista(
        ajustar({
          s,
          x: m.x - c.x - ((g.m0.x - c.x - g.v0.x) * s) / g.v0.s,
          y: m.y - c.y - ((g.m0.y - c.y - g.v0.y) * s) / g.v0.s,
        }),
      );
      setYaAcerco(true);
      return;
    }
    if (g?.tipo === "arrastre") {
      if (g.v0.s > 1) {
        setVista(ajustar({ s: g.v0.s, x: g.v0.x + (p.x - g.x0), y: g.v0.y + (p.y - g.y0) }));
        setLupa(null);
      } else if (e.pointerType === "mouse") {
        moverLupa(p);
      }
    }
  }

  function alSoltar(e: React.PointerEvent<HTMLDivElement>) {
    const p = local(e);
    punteros.current.delete(e.pointerId);
    const g = gesto.current;
    if (g?.tipo === "pinza") {
      if (punteros.current.size < 2) {
        gesto.current = null;
        setVista((v) => (v.s < 1.05 ? QUIETA : v));
      }
      return;
    }
    if (g?.tipo === "arrastre") {
      gesto.current = null;
      // Sin zoom, deslizar con el dedo pasa de foto. Con zoom, mueve la foto.
      if (g.v0.s === 1 && e.pointerType !== "mouse") {
        const dx = p.x - g.x0;
        const dy = p.y - g.y0;
        if (Math.abs(dx) > UMBRAL_DESLIZ && Math.abs(dx) > Math.abs(dy)) ir(dx < 0 ? indice + 1 : indice - 1);
      }
    }
    if (e.pointerType !== "mouse") setLupa(null);
  }

  function alDobleClic(e: React.MouseEvent<HTMLDivElement>) {
    // El doble toque ya se atendió en alBajar; el dblclick que sintetiza el
    // navegador después no tiene que deshacerlo.
    if (ultimoTipo.current !== "mouse") return;
    alternarZoom(local(e));
  }

  const puesta = enCarrito(foto.id);
  const primero = foto.bibNumbers?.split(",")[0]?.trim();
  const dorsal = primero?.length ? primero : null;
  const conZoom = vista.s > 1;
  const pct = Math.round(vista.s * 100);
  const centro = () => ({ x: caja.w / 2, y: caja.h / 2 });

  const lupaEstilo: React.CSSProperties | null =
    conMouse && cargada && !conZoom && lupa && k > 0
      ? {
          left: lupa.x - LUPA,
          top: lupa.y - LUPA,
          backgroundImage: `url("${foto.fullUrl}")`,
          backgroundSize: `${rect.rw * 2}px ${rect.rh * 2}px`,
          backgroundPosition: `${LUPA - (lupa.x - rect.ox) * 2}px ${LUPA - (lupa.y - rect.oy) * 2}px`,
        }
      : null;

  const alt = dorsal ? `Dorsal ${dorsal}` : "Foto del evento";

  const contenido = (
    <div
      className="vf"
      role="dialog"
      aria-modal="true"
      aria-label="Foto"
      data-cerrando={cerrando ? "1" : ""}
      data-zoom={conZoom ? "1" : "0"}
    >
      <div className="vf-arriba">
        <div className="vf-titulo">
          <span className="vf-evento">{evento}</span>
          <span className="vf-etiqueta">
            Foto {indice + 1} de {total}
          </span>
        </div>
        <button type="button" className="vf-boton vf-chico vf-cerrar" onClick={cerrar} aria-label="Cerrar">
          <X />
        </button>
      </div>

      <div className="vf-escenario">
        <div className="vf-canaleta">
          <button type="button" className="vf-boton" onClick={() => ir(indice - 1)} disabled={indice === 0} aria-label="Anterior">
            <ChevronLeft />
          </button>
        </div>

        <div
          ref={marcoRef}
          className="vf-marco"
          data-zoom={conZoom ? "1" : "0"}
          data-barrido={barrido ? "1" : "0"}
          data-pista={cargada && !yaAcerco ? "1" : "0"}
          style={{ "--vf-foto-abajo": `${Math.round(rect.oy + rect.rh)}px` } as React.CSSProperties}
          onPointerDown={alBajar}
          onPointerMove={alMover}
          onPointerUp={alSoltar}
          onPointerCancel={alSoltar}
          onPointerLeave={() => setLupa(null)}
          onDoubleClick={alDobleClic}
          // El menú de «guardar imagen» no se abre sobre la foto. Quien quiere
          // capturar la pantalla igual puede; por eso la marca va en la imagen.
          onContextMenu={(e) => e.preventDefault()}
        >
          <div className="vf-capa" style={{ transform: `translate(${vista.x}px, ${vista.y}px) scale(${vista.s})` }}>
            {foto.previewUrl && !cargada && (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="vf-img vf-previa" src={foto.previewUrl} alt="" draggable={false} />
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={foto.id}
              className="vf-img"
              src={foto.fullUrl}
              alt={alt}
              draggable={false}
              data-cargada={cargada ? "1" : "0"}
              onLoad={(e) => {
                setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight });
                setCargada(true);
              }}
            />
            {barrido && cargada && (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="vf-img vf-nitida" src={foto.fullUrl} alt="" draggable={false} aria-hidden />
            )}
          </div>

          {lupaEstilo && <div className="vf-lupa" style={lupaEstilo} aria-hidden />}

          {!cargada && (
            <div className="vf-cargando" aria-label="Cargando">
              <span />
            </div>
          )}

          <div className="vf-pista" aria-hidden>
            <ZoomIn />
            {conMouse ? "Rueda del mouse o doble clic para acercar" : "Pellizcá o tocá dos veces para acercar"}
          </div>
        </div>

        <div className="vf-canaleta">
          <button type="button" className="vf-boton" onClick={() => ir(indice + 1)} disabled={indice === total - 1} aria-label="Siguiente">
            <ChevronRight />
          </button>
        </div>
      </div>

      <div className="vf-abajo">
        <button type="button" className="vf-boton vf-nav-abajo" onClick={() => ir(indice - 1)} disabled={indice === 0} aria-label="Anterior">
          <ChevronLeft />
        </button>

        <div className="vf-datos">
          <span className="vf-dorsal">{dorsal ? `Dorsal ${dorsal}` : "Foto"}</span>
          <span className="vf-nota">Vista previa con marca de agua · la compra se entrega limpia</span>
          <span className="vf-precio">{precio}</span>
        </div>

        <div className="vf-zoom">
          <button type="button" className="vf-boton vf-menos" onClick={() => setVista((v) => enfocar(centro(), v.s / PASO, v))} disabled={!conZoom} aria-label="Alejar">
            <Minus />
          </button>
          <span className="vf-pct">{pct} %</span>
          <button type="button" className="vf-boton vf-mas" onClick={() => { setVista((v) => enfocar(centro(), v.s * PASO, v)); setYaAcerco(true); }} disabled={vista.s >= ZOOM_MAX} aria-label="Acercar">
            <Plus />
          </button>
          <button type="button" className="vf-boton vf-ajustar" onClick={() => setVista(QUIETA)} disabled={!conZoom}>
            Ajustar
          </button>
        </div>

        <div className="vf-compra">
          <span className="vf-precio">{precio}</span>
          <button type="button" className="vf-boton vf-agregar" data-puesta={puesta ? "1" : "0"} onClick={() => alAlternar(foto)}>
            {puesta ? (
              <>
                <Check />
                <span>En el carrito</span>
              </>
            ) : (
              <>
                <ShoppingCart />
                <span>
                  Agregar<span className="vf-largo"> al carrito</span>
                </span>
              </>
            )}
          </button>
        </div>

        <button type="button" className="vf-boton vf-nav-abajo" onClick={() => ir(indice + 1)} disabled={indice === total - 1} aria-label="Siguiente">
          <ChevronRight />
        </button>

        <span className="vf-ayuda">Deslizá para pasar de foto</span>
      </div>
    </div>
  );

  return createPortal(contenido, document.body);
}
