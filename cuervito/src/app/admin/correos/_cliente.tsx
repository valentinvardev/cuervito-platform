"use client";

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
    <main className="wrap-narrow">
      <div className="head">
        <div>
          <h1>Correos</h1>
          <div className="sub">
            Campañas por condición. Se mandan solas cada {estado.cadaMin} minutos, de a{" "}
            {estado.porTanda}, con tope de {estado.topeDiario} por día.
          </div>
        </div>
        <form action={correrAhoraAction}>
          <button type="submit" className="btn btn-outline" data-tip="Una pasada ahora, sin esperar el tick">
            <i className="ti ti-player-play" /> Correr ahora
          </button>
        </form>
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          fontSize: 13,
          color: "var(--text-tertiary)",
          marginBottom: 18,
        }}
      >
        <span className="status-pill" style={{ color: estado.arrancado ? "var(--success)" : "var(--warning)" }}>
          <i className={`ti ${estado.arrancado ? "ti-circle-check-filled" : "ti-alert-triangle"}`} />
          {estado.arrancado ? "Remitente corriendo" : "Remitente apagado (PROCESADOR_ACTIVO)"}
        </span>
        <span>
          Hoy: <strong>{estado.hoy}</strong> de {estado.topeDiario}
        </span>
        {estado.ultimoResumen && <span>· última pasada {cuando(estado.ultimoResumen.corridaAt)}</span>}
      </div>

      <section className="section">
        {estado.campanas.map((c) => (
          <div
            key={c.id}
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              borderRadius: 14,
              padding: 20,
              marginBottom: 12,
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: 16,
              alignItems: "start",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontWeight: 600 }}>{c.nombre}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-tertiary)" }}>
                  {c.id}
                </span>
              </div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 6, lineHeight: 1.5 }}>
                {c.descripcion}
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 18,
                  marginTop: 12,
                  fontSize: 13,
                  color: "var(--text-tertiary)",
                  flexWrap: "wrap",
                }}
              >
                <span>
                  Califican hoy: <strong style={{ color: c.elegibles > 0 ? "var(--accent)" : undefined }}>{c.elegibles}</strong>
                </span>
                <span>
                  Enviados: <strong>{c.enviados}</strong>
                </span>
                <span>Último: {cuando(c.ultimo)}</span>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 12, alignItems: "center", flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => prueba(c.id)}
                  disabled={pending}
                  data-tip="Te manda este mail a tu propia casilla, sin registrarlo"
                >
                  <i className="ti ti-send" /> Enviarme una prueba
                </button>
                {aviso[c.id] && (
                  <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{aviso[c.id]}</span>
                )}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
              <button
                type="button"
                onClick={() => alternar(c.id)}
                disabled={pending}
                aria-pressed={!!activas[c.id]}
                className={`toggle-switch ${activas[c.id] ? "on" : ""}`}
              >
                <span className="thumb" />
              </button>
              <span
                style={{
                  fontSize: 11,
                  fontFamily: "var(--font-mono)",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: activas[c.id] ? "var(--success)" : "var(--text-tertiary)",
                }}
              >
                {activas[c.id] ? "prendida" : "apagada"}
              </span>
            </div>
          </div>
        ))}
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Últimos envíos</h2>
          <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Los cincuenta más recientes.</div>
        </div>
        {estado.ultimos.length === 0 ? (
          <div
            style={{
              padding: 20,
              background: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              borderRadius: 12,
              color: "var(--text-tertiary)",
              fontSize: 13,
            }}
          >
            Todavía no salió ninguno.
          </div>
        ) : (
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            {estado.ultimos.map((e, i) => (
              <div
                key={e.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto auto",
                  gap: 14,
                  padding: "10px 16px",
                  borderTop: i === 0 ? "none" : "1px solid var(--border-subtle)",
                  fontSize: 13,
                  alignItems: "center",
                }}
              >
                <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {e.nombre ? <b>{e.nombre}</b> : null} <span style={{ color: "var(--text-tertiary)" }}>{e.email}</span>
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent)" }}>
                  {e.campana}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-tertiary)" }}>
                  {cuando(e.cuando)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
