"use client";

import { Mail, Play, Send } from "lucide-react";
import { useState, useTransition } from "react";

import type { estadoCorreos } from "~/server/correos/enviar";

import { correrAhoraAction, enviarPruebaAction, toggleCampanaAction } from "./actions";

type Estado = Awaited<ReturnType<typeof estadoCorreos>>;

/**
 * La pantalla de campañas.
 *
 * Una tarjeta por campaña con lo que hace falta para decidir si prenderla:
 * cuántos califican HOY —que es lo que va a salir en la primera pasada—,
 * cuántos ya la recibieron, y un botón para mandármela a mí antes. Prender
 * algo que manda mails a gente real sin haberlo leído uno mismo es la clase
 * de cosa que se hace una sola vez.
 */
export function Correos({ estado }: { estado: Estado }) {
  const [activas, setActivas] = useState<Record<string, boolean>>(
    Object.fromEntries(estado.campanas.map((c) => [c.id, c.activa])),
  );
  const [aviso, setAviso] = useState<Record<string, string>>({});
  const [pending, empezar] = useTransition();

  function alternar(id: string) {
    const siguiente = !activas[id];
    setActivas((a) => ({ ...a, [id]: siguiente }));
    empezar(async () => {
      try {
        await toggleCampanaAction(id, siguiente);
      } catch (e) {
        setActivas((a) => ({ ...a, [id]: !siguiente }));
        setAviso((v) => ({ ...v, [id]: e instanceof Error ? e.message : "No se pudo guardar" }));
      }
    });
  }

  function prueba(id: string) {
    setAviso((v) => ({ ...v, [id]: "Enviando…" }));
    empezar(async () => {
      const r = await enviarPruebaAction(id);
      setAviso((v) => ({ ...v, [id]: r.detalle }));
    });
  }

  const cuando = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" }) : "nunca";

  return (
    <main className="canvas">
      <div className="canvas-in">
        <div className="head">
          <div>
            <h1>Correos</h1>
            <p>
              Campañas por condición. Se mandan solas cada {estado.cadaMin} minutos, de a{" "}
              {estado.porTanda}, con tope de {estado.topeDiario} por día.
            </p>
          </div>
          <div className="head-r">
            <form action={correrAhoraAction}>
              <button type="submit" className="btn btn-ghost" data-tip="Una pasada ahora, sin esperar el tick">
                <Play /> Correr ahora
              </button>
            </form>
          </div>
        </div>

        <div className="filtros" style={{ fontSize: 13, color: "var(--ink-3)" }}>
          {estado.arrancado ? (
            <span className="pill live">
              <i /> Remitente corriendo
            </span>
          ) : (
            <span className="pill draft">
              <i /> Remitente apagado (PROCESADOR_ACTIVO)
            </span>
          )}
          <span>
            Hoy <b className="tnum" style={{ color: "var(--ink)", fontWeight: 500 }}>{estado.hoy}</b> de{" "}
            {estado.topeDiario}
          </span>
          {estado.ultimoResumen && <span>· última pasada {cuando(estado.ultimoResumen.corridaAt)}</span>}
        </div>

        {estado.campanas.map((c) => (
          <section key={c.id} className="card">
            <div className="aj" style={{ padding: 0 }}>
              <div className="aj-t">
                <b>
                  {c.nombre}{" "}
                  <span style={{ fontWeight: 400, color: "var(--ink-3)", fontSize: 12 }}>{c.id}</span>
                </b>
                <span>{c.descripcion}</span>
                <div
                  style={{
                    display: "flex",
                    gap: "var(--s-4)",
                    marginTop: 10,
                    fontSize: 13,
                    color: "var(--ink-3)",
                    flexWrap: "wrap",
                  }}
                >
                  <span>
                    Califican hoy:{" "}
                    <b className="tnum" style={{ fontWeight: 500, color: c.elegibles > 0 ? "var(--acento-txt)" : "var(--ink)" }}>
                      {c.elegibles}
                    </b>
                  </span>
                  <span>
                    Enviados: <b className="tnum" style={{ fontWeight: 500, color: "var(--ink)" }}>{c.enviados}</b>
                  </span>
                  <span>Último: {cuando(c.ultimo)}</span>
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => prueba(c.id)}
                    disabled={pending}
                    data-tip="Te manda este mail a tu propia casilla, sin registrarlo"
                  >
                    <Send /> Enviarme una prueba
                  </button>
                  {aviso[c.id] && <span style={{ fontSize: 12.5, color: "var(--ink-2)" }}>{aviso[c.id]}</span>}
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <button
                  type="button"
                  role="switch"
                  aria-checked={!!activas[c.id]}
                  aria-label={activas[c.id] ? "Apagar la campaña" : "Prender la campaña"}
                  className="sw"
                  onClick={() => alternar(c.id)}
                  disabled={pending}
                />
                <span style={{ fontSize: 11, color: activas[c.id] ? "var(--ok-txt)" : "var(--ink-3)" }}>
                  {activas[c.id] ? "prendida" : "apagada"}
                </span>
              </div>
            </div>
          </section>
        ))}

        <section className="card">
          <div className="card-h">
            <div>
              <h2>Últimos envíos</h2>
              <div className="sub">Los cincuenta más recientes.</div>
            </div>
          </div>
          {estado.ultimos.length === 0 ? (
            <div className="empty" style={{ padding: "var(--s-5) var(--s-4)" }}>
              <div className="empty-i">
                <Mail />
              </div>
              <h3>Todavía no salió ninguno</h3>
              <p>Cuando una campaña esté prendida y alguien califique, aparece acá.</p>
            </div>
          ) : (
            <>
              <div className="row row-h ct">
                <span>Quién</span>
                <span>Campaña</span>
                <span className="num oc">Cuándo</span>
              </div>
              {estado.ultimos.map((e) => (
                <div key={e.id} className="row ct">
                  <span className="v-who">
                    <b>{e.nombre ?? e.email}</b>
                    {e.nombre && <span>{e.email}</span>}
                  </span>
                  <span>
                    <span className="pill">
                      <i /> {e.campana}
                    </span>
                  </span>
                  <span className="num soft oc">{cuando(e.cuando)}</span>
                </div>
              ))}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
