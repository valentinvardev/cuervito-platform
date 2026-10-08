"use client";

import { Check, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { PLANTILLAS, type IdPlantilla } from "~/app/_portfolio/plantillas/registro";

import { borrarPortfolioAction, cambiarPlantillaAction } from "../acciones";

export function Ajustes({ portfolioId, plantilla }: { portfolioId: string; plantilla: IdPlantilla }) {
  const router = useRouter();
  const [actual, setActual] = useState(plantilla);
  const [confirmar, setConfirmar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();

  function elegir(id: IdPlantilla) {
    if (id === actual) return;
    setError(null);
    empezar(async () => {
      const r = await cambiarPlantillaAction(portfolioId, id);
      if (r.error) setError(r.error);
      else setActual(id);
    });
  }

  function borrar() {
    empezar(async () => {
      const r = await borrarPortfolioAction(portfolioId);
      if (r.error) setError(r.error);
      else router.push("/dashboard/portfolio");
    });
  }

  return (
    <div style={{ display: "grid", gap: "var(--s-4)", maxWidth: 760 }}>
      <section className="card">
        <div className="card-h">
          <div>
            <h2>Plantilla</h2>
            <div className="sub">Al cambiarla, los textos vuelven a los de la plantilla nueva. Las fotos quedan.</div>
          </div>
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          {(Object.keys(PLANTILLAS) as IdPlantilla[]).map((id) => {
            const t = PLANTILLAS[id];
            return (
              <button
                key={id}
                type="button"
                className="pfa-evento"
                aria-current={actual === id}
                disabled={pendiente}
                onClick={() => elegir(id)}
                style={{ border: "1px solid var(--line-soft)" }}
              >
                <span className="sin" style={{ background: t.defaultPalette?.bg, border: `3px solid ${t.defaultPalette?.accent}` }} />
                <div>
                  <b>{t.name}</b>
                  <small>{t.descripcion}</small>
                </div>
                {actual === id && <Check style={{ width: 16, height: 16 }} />}
              </button>
            );
          })}
        </div>
      </section>

      <section className="card pf-peligro">
        <div className="card-h" style={{ marginBottom: 12 }}>
          <div>
            <h2>Borrar el portfolio</h2>
            <div className="sub">Se borra la página y sus consultas. Las fotos siguen en tus eventos.</div>
          </div>
        </div>
        {confirmar ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="btn btn-sm" style={{ background: "var(--bad)", color: "#fff" }} onClick={borrar} disabled={pendiente}>
              <Trash2 /> {pendiente ? "Borrando…" : "Sí, borrarlo"}
            </button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setConfirmar(false)}>
              Cancelar
            </button>
          </div>
        ) : (
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setConfirmar(true)}>
            <Trash2 /> Borrar
          </button>
        )}
      </section>
      {error && <p className="pfa-error" role="alert">{error}</p>}
    </div>
  );
}
