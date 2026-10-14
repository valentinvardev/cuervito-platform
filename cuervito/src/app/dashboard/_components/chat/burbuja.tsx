"use client";

import { MessageCircle, Send, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";

import { whatsappUrl } from "~/lib/support";
import type { EventoChat } from "~/server/chat-bus";
import type { EstadoConversacion, MensajeDTO } from "~/server/chat";

import { GlifoWhatsapp } from "../glifo-whatsapp";
import { enviarAction, hiloAction, leidoAction } from "./acciones";
import { MAX_TEXTO, horaDe, porDia, unirMensajes } from "./formato-chat";

/**
 * La burbuja del chat de soporte, en el panel del fotógrafo.
 *
 * Una burbuja que se arrastra a donde moleste menos (la posición queda en
 * localStorage), con el número de respuestas sin leer, y adentro el hilo con
 * encontrate: el mismo para siempre, no uno por consulta. Abajo del todo, el
 * botón de WhatsApp para quien prefiera eso.
 *
 * En vivo por el mismo camino que las ventas: /api/chat/stream avisa QUE
 * pasó algo y la base dice qué. Lo que llegue mientras el SSE estaba cortado
 * se pide al reconectar, desde el último mensaje que se tiene.
 *
 * "En línea" sólo cuando un admin tiene la bandeja abierta. Si no, dice lo que
 * es verdad: te respondemos por acá y te avisamos por mail.
 */

const CLAVE_POS = "cuervito-chat-pos";
const EVENTO_ABRIR = "cuervito:chat:abrir";
const TAMANO = 52;
const MARGEN = 8;

/** Desde el riel ("Escribinos") o cualquier otro lado: abre el panel. */
export function abrirChat() {
  window.dispatchEvent(new Event(EVENTO_ABRIR));
}

type Pos = { dr: number; db: number };
const POS_INICIAL: Pos = { dr: 20, db: 20 };

function acotar(p: Pos): Pos {
  const maxR = Math.max(MARGEN, window.innerWidth - TAMANO - MARGEN);
  const maxB = Math.max(MARGEN, window.innerHeight - TAMANO - MARGEN);
  return {
    dr: Math.min(Math.max(MARGEN, Math.round(p.dr)), maxR),
    db: Math.min(Math.max(MARGEN, Math.round(p.db)), maxB),
  };
}

function leerPos(): Pos {
  try {
    const raw = localStorage.getItem(CLAVE_POS);
    if (!raw) return acotar(POS_INICIAL);
    const p = JSON.parse(raw) as Partial<Pos>;
    if (typeof p.dr !== "number" || typeof p.db !== "number") return acotar(POS_INICIAL);
    return acotar({ dr: p.dr, db: p.db });
  } catch {
    return POS_INICIAL;
  }
}

/** ?chat=1 abre el panel: es a donde llevan los mails de "te respondieron". */
function AbrirDesdeUrl({ abrir }: { abrir: () => void }) {
  const pedido = useSearchParams().get("chat") === "1";
  useEffect(() => {
    if (!pedido) return;
    abrir();
    const url = new URL(window.location.href);
    url.searchParams.delete("chat");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  }, [pedido, abrir]);
  return null;
}

export function BurbujaChat() {
  const [montado, setMontado] = useState(false);
  const [pos, setPos] = useState<Pos>(POS_INICIAL);
  const [abierto, setAbierto] = useState(false);

  const [mensajes, setMensajes] = useState<MensajeDTO[]>([]);
  const [estado, setEstado] = useState<EstadoConversacion | null>(null);
  const [cargado, setCargado] = useState(false);
  const [noLeidos, setNoLeidos] = useState(0);
  const [enLinea, setEnLinea] = useState(false);

  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hiloRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  // Para pedir "lo que haya desde acá" al reconectar.
  const ultimoRef = useRef<string | null>(null);
  const abiertoRef = useRef(false);
  const cargadoRef = useRef(false);
  const leidoReloj = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    abiertoRef.current = abierto;
  }, [abierto]);
  useEffect(() => {
    cargadoRef.current = cargado;
  }, [cargado]);
  useEffect(() => {
    ultimoRef.current = mensajes.length ? mensajes[mensajes.length - 1]!.createdAt : null;
  }, [mensajes]);

  // La posición guardada se lee después de montar: en el servidor no hay
  // localStorage, y hasta entonces la burbuja no se dibuja para no saltar.
  useEffect(() => {
    setPos(leerPos());
    setMontado(true);
    const alCambiar = () => setPos((p) => acotar(p));
    addEventListener("resize", alCambiar);
    return () => removeEventListener("resize", alCambiar);
  }, []);

  /** Avisa que se leyó hasta ahora, juntando varias llegadas en una llamada. */
  const marcarLeido = useCallback(() => {
    setNoLeidos(0);
    if (leidoReloj.current) clearTimeout(leidoReloj.current);
    leidoReloj.current = setTimeout(() => void leidoAction(), 300);
  }, []);

  const cargar = useCallback(async (desde?: string) => {
    const h = await hiloAction(desde);
    setMensajes((prev) => (desde ? unirMensajes(prev, h.mensajes) : h.mensajes));
    setEstado(h.estado);
    setEnLinea(h.adminsEnLinea);
    setCargado(true);
    if (!desde) setNoLeidos(h.noLeidos);
  }, []);

  const abrir = useCallback(() => {
    setAbierto(true);
    if (!cargadoRef.current) void cargar();
  }, [cargar]);
  const cerrar = useCallback(() => setAbierto(false), []);

  // Al abrir: lo que había sin leer queda leído, y el cursor va al campo.
  useEffect(() => {
    if (!abierto) return;
    if (noLeidos > 0) marcarLeido();
    const t = setTimeout(() => taRef.current?.focus(), 50);
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
    };
    addEventListener("keydown", esc);
    return () => {
      clearTimeout(t);
      removeEventListener("keydown", esc);
    };
    // Sólo al abrir: los no leídos que lleguen después los maneja el SSE.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  useEffect(() => {
    const alPedir = () => abrir();
    addEventListener(EVENTO_ABRIR, alPedir);
    return () => removeEventListener(EVENTO_ABRIR, alPedir);
  }, [abrir]);

  // Siempre abajo del todo cuando entra algo, como cualquier chat.
  useEffect(() => {
    const el = hiloRef.current;
    if (el && abierto) el.scrollTop = el.scrollHeight;
  }, [mensajes, abierto, cargado]);

  // El SSE: una conexión por pestaña, abierta esté o no el panel, porque el
  // número de la burbuja tiene que moverse igual.
  useEffect(() => {
    const es = new EventSource("/api/chat/stream");
    let conexiones = 0;

    es.addEventListener("open", () => {
      conexiones++;
      // La primera es la normal. Las demás son reconexiones: lo que pasó en
      // el medio no vuelve solo.
      if (conexiones > 1 && cargadoRef.current) void cargar(ultimoRef.current ?? undefined);
    });

    es.addEventListener("hello", (e) => {
      try {
        const h = JSON.parse((e as MessageEvent<string>).data) as { noLeidos: number; adminsEnLinea: boolean };
        setEnLinea(h.adminsEnLinea);
        if (!abiertoRef.current) setNoLeidos(h.noLeidos);
      } catch {
        // nada
      }
    });

    es.addEventListener("chat", (e) => {
      let ev: EventoChat;
      try {
        ev = JSON.parse((e as MessageEvent<string>).data) as EventoChat;
      } catch {
        return;
      }
      if (ev.tipo === "presencia") {
        setEnLinea(ev.adminsEnLinea);
      } else if (ev.tipo === "estado") {
        setEstado(ev.estado);
      } else if (ev.tipo === "mensaje") {
        const m: MensajeDTO = {
          id: ev.mensaje.id,
          deAdmin: ev.mensaje.deAdmin,
          texto: ev.mensaje.texto,
          createdAt: ev.mensaje.createdAt,
        };
        if (cargadoRef.current) setMensajes((prev) => unirMensajes(prev, [m]));
        if (m.deAdmin) {
          if (abiertoRef.current) marcarLeido();
          else setNoLeidos((n) => n + 1);
        }
      }
    });

    return () => {
      es.close();
      if (leidoReloj.current) clearTimeout(leidoReloj.current);
    };
  }, [cargar, marcarLeido]);

  /* ── Arrastre ──────────────────────────────────────────────────────────── */

  const arrastre = useRef<{ x: number; y: number; dr: number; db: number; movio: boolean } | null>(null);

  function alBajar(e: React.PointerEvent<HTMLButtonElement>) {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    arrastre.current = { x: e.clientX, y: e.clientY, dr: pos.dr, db: pos.db, movio: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function alMover(e: React.PointerEvent<HTMLButtonElement>) {
    const a = arrastre.current;
    if (!a) return;
    const dx = e.clientX - a.x;
    const dy = e.clientY - a.y;
    // Seis píxeles separan un click con pulso de un arrastre.
    if (!a.movio && Math.hypot(dx, dy) < 6) return;
    a.movio = true;
    setPos(acotar({ dr: a.dr - dx, db: a.db - dy }));
  }
  function alSoltar(e: React.PointerEvent<HTMLButtonElement>) {
    const a = arrastre.current;
    arrastre.current = null;
    if (!a) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ya suelto
    }
    if (a.movio) {
      try {
        localStorage.setItem(CLAVE_POS, JSON.stringify(acotar({ dr: a.dr - (e.clientX - a.x), db: a.db - (e.clientY - a.y) })));
      } catch {
        // sin almacenamiento: dura lo que dure la pestaña
      }
      return;
    }
    if (abierto) cerrar();
    else abrir();
  }

  /* ── Enviar ────────────────────────────────────────────────────────────── */

  async function enviar() {
    const t = texto.trim();
    if (!t || enviando) return;
    setEnviando(true);
    setError(null);
    const r = await enviarAction(t);
    setEnviando(false);
    if ("error" in r) {
      setError(r.error);
      return;
    }
    setTexto("");
    setEstado("ABIERTA");
    setMensajes((prev) => unirMensajes(prev, [r.mensaje]));
    if (taRef.current) taRef.current.style.height = "";
    taRef.current?.focus();
  }

  function alTeclear(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void enviar();
    }
  }

  function alEscribir(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setTexto(e.target.value.slice(0, MAX_TEXTO));
    const el = e.target;
    el.style.height = "";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }

  if (!montado) return null;

  // De qué lado está la burbuja decide de qué lado se abre el panel. Las
  // distancias se miden desde la derecha y desde abajo: una distancia grande
  // es una burbuja a la izquierda, o arriba.
  const h = pos.dr + TAMANO / 2 > window.innerWidth / 2 ? "izq" : "der";
  const v = pos.db + TAMANO / 2 > window.innerHeight / 2 ? "abajo" : "arriba";
  const grupos = porDia(mensajes);

  return (
    <div
      className="chat-raiz"
      style={{ "--dr": `${pos.dr}px`, "--db": `${pos.db}px` } as React.CSSProperties}
      data-h={h}
      data-v={v}
    >
      {abierto && (
        <section className="chat-panel" role="dialog" aria-label="Chat con encontrate">
          <header className="chat-cab">
            <div className="chat-cab-t">
              <b>encontrate</b>
              <span className={`pill${enLinea ? " live" : ""}`}>
                <i /> {enLinea ? "En línea" : "Te respondemos por acá"}
              </span>
            </div>
            <button type="button" className="btn btn-ghost btn-icon" onClick={cerrar} aria-label="Cerrar el chat">
              <X />
            </button>
          </header>

          <div className="chat-hilo" ref={hiloRef}>
            {!cargado ? (
              <div className="chat-vacio">
                <p>Cargando…</p>
              </div>
            ) : mensajes.length === 0 ? (
              <div className="chat-vacio">
                <h3>¿En qué te ayudamos?</h3>
                <p>Contanos qué pasa. Te respondemos por acá y, si no estás en el panel, te avisamos por mail.</p>
              </div>
            ) : (
              grupos.map((g) => (
                <div key={g.dia} className="chat-dia">
                  <span className="chat-dia-t">{g.dia}</span>
                  {g.mensajes.map((m) => (
                    <div key={m.id} className="chat-m" data-de={m.deAdmin ? "ellos" : "yo"}>
                      <span className="chat-m-t">{m.texto}</span>
                      <time className="chat-m-h" dateTime={m.createdAt}>
                        {horaDe(m.createdAt)}
                      </time>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>

          {estado === "RESUELTA" && <div className="chat-nota">Quedó como resuelta. Si escribís, se vuelve a abrir.</div>}
          {error && (
            <div className="chat-nota bad" role="alert">
              {error}
            </div>
          )}

          <form
            className="chat-form"
            onSubmit={(e) => {
              e.preventDefault();
              void enviar();
            }}
          >
            <textarea
              ref={taRef}
              className="ta chat-ta"
              rows={1}
              placeholder="Escribí tu mensaje"
              value={texto}
              onChange={alEscribir}
              onKeyDown={alTeclear}
              maxLength={MAX_TEXTO}
              aria-label="Tu mensaje"
            />
            <button
              type="submit"
              className="btn btn-pri btn-icon chat-enviar"
              disabled={!texto.trim() || enviando}
              aria-label="Enviar"
            >
              <Send />
            </button>
          </form>

          <a
            className="chat-wa"
            href={whatsappUrl("Hola, escribo desde el panel de encontrate.app")}
            target="_blank"
            rel="noopener"
          >
            <GlifoWhatsapp />
            Prefiero WhatsApp
          </a>
        </section>
      )}

      <button
        type="button"
        className="chat-burbuja"
        onPointerDown={alBajar}
        onPointerMove={alMover}
        onPointerUp={alSoltar}
        onPointerCancel={alSoltar}
        aria-label={abierto ? "Cerrar el chat de soporte" : "Abrir el chat de soporte"}
        aria-expanded={abierto}
        title="Arrastrá para moverla"
      >
        {abierto ? <X /> : <MessageCircle />}
        {!abierto && noLeidos > 0 && (
          <span className="chat-n" aria-label={`${noLeidos} sin leer`}>
            {noLeidos > 9 ? "9+" : noLeidos}
          </span>
        )}
      </button>

      <Suspense fallback={null}>
        <AbrirDesdeUrl abrir={abrir} />
      </Suspense>
    </div>
  );
}
