"use client";

import { Mail, MailOpen } from "lucide-react";
import { useState, useTransition } from "react";

import { marcarConsultaAction } from "../acciones";

type Consulta = { id: string; nombre: string; email: string; mensaje: string; createdAt: Date; leidaAt: Date | null };

const fecha = (d: Date) =>
  d.toLocaleString("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" });

/** Las consultas del formulario de contacto. Responder abre el mail, con el asunto armado. */
export function Consultas({ consultas }: { consultas: Consulta[] }) {
  const [abierta, setAbierta] = useState<string | null>(consultas.find((c) => !c.leidaAt)?.id ?? null);
  const [leidas, setLeidas] = useState(() => new Set(consultas.filter((c) => c.leidaAt).map((c) => c.id)));
  const [, empezar] = useTransition();

  function marcar(id: string, leida: boolean) {
    setLeidas((s) => {
      const c = new Set(s);
      if (leida) c.add(id);
      else c.delete(id);
      return c;
    });
    empezar(async () => {
      await marcarConsultaAction(id, leida);
    });
  }

  if (consultas.length === 0) {
    return (
      <section className="card empty">
        <div className="empty-i"><Mail /></div>
        <h3>Todavía no te escribieron</h3>
        <p>Cuando alguien use el formulario de contacto del portfolio, la consulta aparece acá y te llega por mail.</p>
      </section>
    );
  }

  return (
    <section className="card">
      {consultas.map((c) => {
        const leida = leidas.has(c.id);
        const abierto = abierta === c.id;
        return (
          <div key={c.id}>
            <button
              type="button"
              className={`pf-consulta${leida ? " leida" : ""}`}
              style={{ width: "100%", background: "none", border: 0, borderTop: "1px solid var(--line-soft)", font: "inherit", color: "inherit", textAlign: "left", cursor: "pointer" }}
              aria-expanded={abierto}
              onClick={() => {
                setAbierta(abierto ? null : c.id);
                if (!leida) marcar(c.id, true);
              }}
            >
              <span className={leida ? "" : "punto"} />
              <span className="quien">{c.nombre}</span>
              <span className="que">{c.mensaje}</span>
              <span className="cuando">{fecha(c.createdAt)}</span>
            </button>
            {abierto && (
              <div style={{ display: "grid", gap: 14, padding: "4px 0 18px 24px" }}>
                <p style={{ whiteSpace: "pre-wrap", fontSize: 14.5, lineHeight: 1.6 }}>{c.mensaje}</p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <a className="btn btn-sm btn-pri" href={`mailto:${c.email}?subject=${encodeURIComponent("Tu consulta desde mi portfolio")}`}>
                    <Mail /> Responder a {c.email}
                  </a>
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => marcar(c.id, !leida)}>
                    <MailOpen /> {leida ? "Marcar como no leída" : "Marcar como leída"}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
