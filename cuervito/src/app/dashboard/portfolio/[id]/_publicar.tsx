"use client";

import { Globe, EyeOff } from "lucide-react";
import { useState, useTransition } from "react";

import { publicarPortfolioAction } from "../acciones";

export function Publicar({ id, publicado }: { id: string; publicado: boolean }) {
  const [pendiente, empezar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function cambiar() {
    setError(null);
    empezar(async () => {
      const r = await publicarPortfolioAction(id, !publicado);
      if (r.error) setError(r.error);
    });
  }

  return (
    <>
      {publicado ? (
        <button type="button" className="btn btn-ghost" onClick={cambiar} disabled={pendiente}>
          <EyeOff /> {pendiente ? "Despublicando…" : "Despublicar"}
        </button>
      ) : (
        <button type="button" className="btn btn-pri" onClick={cambiar} disabled={pendiente}>
          <Globe /> {pendiente ? "Publicando…" : "Publicar"}
        </button>
      )}
      {error && <span className="pfa-error" role="alert">{error}</span>}
    </>
  );
}
