"use client";

import { Check } from "lucide-react";
import { useState, useTransition } from "react";

import { DISCIPLINAS } from "~/lib/disciplinas";

import { Desplegable } from "~/app/dashboard/_components/desplegable";

import { guardarDatosEventoAction } from "./acciones";

/** Una fila: disciplina y lugar editables, con guardado al tocar el tilde. */
export function FilaDatos({
  evento,
}: {
  evento: { id: string; nombre: string; fotografo: string; fecha: string | null; discipline: string | null; location: string | null };
}) {
  const [discipline, setDiscipline] = useState(evento.discipline ?? "");
  const [location, setLocation] = useState(evento.location ?? "");
  const [estado, setEstado] = useState<"" | "guardado" | "error">("");
  const [pending, empezar] = useTransition();
  const cambio = discipline !== (evento.discipline ?? "") || location !== (evento.location ?? "");

  function guardar() {
    empezar(async () => {
      const r = await guardarDatosEventoAction({ eventId: evento.id, discipline, location });
      setEstado(r.error ? "error" : "guardado");
    });
  }

  return (
    <div className="row" style={{ alignItems: "center" }}>
      <div style={{ minWidth: 0 }}>
        <b style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{evento.nombre}</b>
        <small style={{ color: "var(--ink-3)" }}>
          {evento.fotografo}
          {evento.fecha ? ` · ${evento.fecha}` : ""}
        </small>
      </div>
      <Desplegable opciones={DISCIPLINAS.map((d) => ({ valor: d, texto: d }))} valor={discipline} alCambiar={setDiscipline} />
      <input
        className="inp"
        placeholder="Tandil, Buenos Aires"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && cambio) guardar();
        }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
        {estado === "guardado" && !cambio && <small style={{ color: "var(--ok-txt)" }}>Guardado</small>}
        {estado === "error" && <small style={{ color: "var(--bad-txt)" }}>No se guardó</small>}
        <button type="button" className="btn btn-pri btn-sm btn-icon" aria-label="Guardar" disabled={!cambio || pending} onClick={guardar}>
          <Check />
        </button>
      </div>
    </div>
  );
}
