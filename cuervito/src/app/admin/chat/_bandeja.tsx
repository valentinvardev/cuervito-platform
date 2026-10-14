"use client";

import { Check, MessageCircle, RotateCcw, Send } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { hace, iniciales } from "~/app/dashboard/_components/formato";
import { MAX_TEXTO, horaDe, porDia, unirMensajes } from "~/app/dashboard/_components/chat/formato-chat";
import type { EventoChat } from "~/server/chat-bus";
import type { FilaBandeja, HiloAdmin, MensajeDTO } from "~/server/chat";

import { estadoAction, leidoAdminAction, mensajesDesdeAction, responderAction } from "./acciones";

/**
 * La bandeja, del lado del navegador: la lista a la izquierda y el hilo
 * elegido a la derecha, los dos en vivo.
 *
 * El SSE se abre con `presencia=1`: mientras esta pantalla esté abierta, los
 * fotógrafos ven "En línea" en su burbuja. Por eso vive acá y no en el
 * armazón: la promesa se hace sólo cuando alguien está mirando.
 *
 * Lo que llega por el SSE para el hilo abierto se suma a la lista de
 * mensajes; lo demás (otro hilo, un cambio de estado) pide la página de
 * nuevo con router.refresh(), que es lo que mantiene la lista y el número
 * del riel al día sin calcular nada acá.
 */

export function Bandeja({
  filas,
  hilo,
  foto,
  filtro,
}: {
  filas: FilaBandeja[];
  hilo: HiloAdmin | null;
  /** La foto del usuario del hilo, ya resuelta a URL. */
  foto: string | null;
  filtro: string;
}) {
  const router = useRouter();
  const hiloId = hilo?.id ?? null;
  const hiloRef = useRef<string | null>(hiloId);
  hiloRef.current = hiloId;
  const ultimoRef = useRef<string | null>(null);
  const agregarRef = useRef<(m: MensajeDTO[]) => void>(() => undefined);

  useEffect(() => {
    const es = new EventSource("/api/admin/chat/stream?presencia=1");
    let conexiones = 0;
    let refresco: ReturnType<typeof setTimeout> | null = null;
    const refrescar = () => {
      if (refresco) clearTimeout(refresco);
      refresco = setTimeout(() => router.refresh(), 250);
    };

    es.addEventListener("open", () => {
      conexiones++;
      if (conexiones === 1) return;
      // Reconexión: lo que pasó en el medio no vuelve solo.
      const id = hiloRef.current;
      if (id) {
        void mensajesDesdeAction(id, ultimoRef.current ?? new Date(0).toISOString()).then((ms) => agregarRef.current(ms));
      }
      refrescar();
    });

    es.addEventListener("chat", (e) => {
      let ev: EventoChat;
      try {
        ev = JSON.parse((e as MessageEvent<string>).data) as EventoChat;
      } catch {
        return;
      }
      if (ev.tipo === "mensaje") {
        const m = ev.mensaje;
        if (m.conversacionId === hiloRef.current) {
          agregarRef.current([{ id: m.id, deAdmin: m.deAdmin, texto: m.texto, createdAt: m.createdAt }]);
          if (!m.deAdmin) void leidoAdminAction(m.conversacionId);
        }
        refrescar();
      } else if (ev.tipo === "estado" || (ev.tipo === "leido" && ev.lado === "admin")) {
        refrescar();
      }
    });

    return () => {
      es.close();
      if (refresco) clearTimeout(refresco);
    };
  }, [router]);

  return (
    <div className="bandeja" data-con-hilo={hilo ? "1" : undefined}>
      <section className="card bandeja-lista-card">
        {filas.length === 0 ? (
          <div className="empty">
            <div className="empty-i">
              <MessageCircle />
            </div>
            <h3>{filtro === "abiertas" ? "Nada abierto" : "Nada por acá"}</h3>
            <p>
              {filtro === "abiertas"
                ? "Cuando un fotógrafo escriba desde el panel, aparece acá."
                : "Las conversaciones que entren en este filtro van a aparecer acá."}
            </p>
          </div>
        ) : (
          <div className="bandeja-lista">
            {filas.map((f) => (
              <Link
                key={f.id}
                href={`/admin/chat?f=${filtro}&c=${f.id}`}
                className="bandeja-f"
                aria-current={f.id === hiloId ? "true" : undefined}
                prefetch={false}
              >
                <span className="bandeja-av">{iniciales(f.usuario.nombre)}</span>
                <span className="bandeja-f-t">
                  <b>{f.usuario.nombre}</b>
                  <span className="bandeja-f-x">
                    {f.ultimo ? (
                      <>
                        {f.ultimo.deAdmin && <i>Vos: </i>}
                        {f.ultimo.texto.split("\n")[0]}
                      </>
                    ) : (
                      "Sin mensajes"
                    )}
                  </span>
                </span>
                <span className="bandeja-f-r">
                  <span className="bandeja-f-h">{hace(new Date(f.ultimoMensajeAt))}</span>
                  {f.noLeidos > 0 ? (
                    <span className="bandeja-n">{f.noLeidos}</span>
                  ) : f.estado === "RESUELTA" ? (
                    <Check style={{ width: 13, height: 13, opacity: 0.6 }} />
                  ) : null}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="card hilo-admin">
        {hilo ? (
          <Hilo
            key={hilo.id}
            hilo={hilo}
            foto={foto}
            filtro={filtro}
            registrar={(fn, ultimo) => {
              agregarRef.current = fn;
              ultimoRef.current = ultimo;
            }}
          />
        ) : (
          <div className="hilo-vacio">
            {filas.length === 0 ? "Todavía no escribió nadie." : "Elegí una conversación de la lista."}
          </div>
        )}
      </section>
    </div>
  );
}

function Hilo({
  hilo,
  foto,
  filtro,
  registrar,
}: {
  hilo: HiloAdmin;
  foto: string | null;
  filtro: string;
  /** Le da a la bandeja cómo sumar mensajes a este hilo y desde cuándo pedir. */
  registrar: (agregar: (ms: MensajeDTO[]) => void, ultimo: string | null) => void;
}) {
  const router = useRouter();
  const [mensajes, setMensajes] = useState<MensajeDTO[]>(hilo.mensajes);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listaRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Lo que trae el servidor en un refresh se suma, no reemplaza: el SSE puede
  // haber dejado algo más nuevo que lo que la página acaba de leer.
  useEffect(() => {
    setMensajes((prev) => unirMensajes(prev, hilo.mensajes));
  }, [hilo.mensajes]);

  useEffect(() => {
    registrar(
      (ms) => setMensajes((prev) => unirMensajes(prev, ms)),
      mensajes.length ? mensajes[mensajes.length - 1]!.createdAt : null,
    );
  }, [registrar, mensajes]);

  // Al abrir el hilo, queda leído, y la lista y el riel se enteran.
  useEffect(() => {
    void leidoAdminAction(hilo.id).then(() => router.refresh());
    taRef.current?.focus();
  }, [hilo.id, router]);

  useEffect(() => {
    const el = listaRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [mensajes]);

  async function enviar() {
    const t = texto.trim();
    if (!t || enviando) return;
    setEnviando(true);
    setError(null);
    const r = await responderAction(hilo.id, t);
    setEnviando(false);
    if ("error" in r) {
      setError(r.error);
      return;
    }
    setTexto("");
    setMensajes((prev) => unirMensajes(prev, [r.mensaje]));
    if (taRef.current) taRef.current.style.height = "";
    taRef.current?.focus();
  }

  async function cambiar(estado: "ABIERTA" | "RESUELTA") {
    const r = await estadoAction(hilo.id, estado);
    if (r.error) setError(r.error);
    else router.refresh();
  }

  const u = hilo.usuario;
  const desde = new Date(u.createdAt).toLocaleDateString("es-AR", { month: "short", year: "numeric" });
  const grupos = porDia(mensajes);

  return (
    <>
      <div className="hilo-cab">
        <div className="hilo-quien">
          <span className="bandeja-av">
            {foto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={foto} alt="" />
            ) : (
              iniciales(u.nombre)
            )}
          </span>
          <div style={{ minWidth: 0 }}>
            <b>{u.nombre}</b>
            <div className="hilo-quien-s">
              <Link href={`/admin/users/${u.id}`} prefetch={false}>
                Ficha
              </Link>
              {u.slug && (
                <a href={`/${u.slug}`} target="_blank" rel="noopener">
                  encontrate.app/{u.slug}
                </a>
              )}
              {u.email && <a href={`mailto:${u.email}`}>{u.email}</a>}
              <span>desde {desde}</span>
              <span>{u.mpConectado ? "MP conectado" : "sin MP"}</span>
              <span>
                {u.eventos} {u.eventos === 1 ? "evento" : "eventos"} · {u.ventas} {u.ventas === 1 ? "venta" : "ventas"}
              </span>
            </div>
          </div>
        </div>
        <div className="hilo-acciones">
          {hilo.estado === "RESUELTA" ? (
            <button type="button" className="btn btn-ghost" onClick={() => void cambiar("ABIERTA")} data-tip="Vuelve a Abiertas">
              <RotateCcw /> <span>Reabrir</span>
            </button>
          ) : (
            <button type="button" className="btn btn-ghost" onClick={() => void cambiar("RESUELTA")} data-tip="Se va de Abiertas; si el fotógrafo escribe, vuelve">
              <Check /> <span>Resuelta</span>
            </button>
          )}
        </div>
      </div>

      <div className="chat-hilo" ref={listaRef}>
        {grupos.length === 0 ? (
          <div className="chat-vacio">
            <p>Sin mensajes todavía.</p>
          </div>
        ) : (
          grupos.map((g) => (
            <div key={g.dia} className="chat-dia">
              <span className="chat-dia-t">{g.dia}</span>
              {g.mensajes.map((m) => (
                <div key={m.id} className="chat-m" data-de={m.deAdmin ? "yo" : "ellos"}>
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
          placeholder={`Responderle a ${u.nombre.split(" ")[0]}`}
          value={texto}
          maxLength={MAX_TEXTO}
          onChange={(e) => {
            setTexto(e.target.value.slice(0, MAX_TEXTO));
            e.target.style.height = "";
            e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void enviar();
            }
          }}
          aria-label="Tu respuesta"
        />
        <button type="submit" className="btn btn-pri btn-icon chat-enviar" disabled={!texto.trim() || enviando} aria-label="Enviar">
          <Send />
        </button>
      </form>
      {/* El filtro viaja en la URL de la lista; acá sólo para que el link de
          "volver" del teléfono lo conserve. */}
      <Link href={`/admin/chat?f=${filtro}`} className="hilo-volver" prefetch={false}>
        Volver a la lista
      </Link>
    </>
  );
}
