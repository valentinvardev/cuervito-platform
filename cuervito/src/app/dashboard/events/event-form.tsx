"use client";

import Link from "next/link";
import { useActionState } from "react";

import type { EventFormState } from "./actions";

type Initial = {
  name?: string;
  discipline?: string | null;
  location?: string | null;
  eventDate?: string | null;
  pricePerPhoto?: number;
  description?: string | null;
};

export function EventForm({
  action,
  submitLabel,
  initial,
}: {
  action: (state: EventFormState, fd: FormData) => Promise<EventFormState>;
  submitLabel: string;
  initial?: Initial;
}) {
  const [state, formAction, pending] = useActionState<EventFormState, FormData>(action, {
    error: null,
  });
  const fe = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="event-form">
      <div className="form-grid">
        <div className="field full">
          <label className="label">Nombre del evento</label>
          <input
            name="name"
            className={`input ${fe.name ? "input-error" : ""}`}
            placeholder="Maratón Internacional Buenos Aires"
            defaultValue={initial?.name ?? ""}
            required
            autoFocus
          />
          {fe.name && <div className="field-error"><i className="ti ti-alert-circle" />{fe.name}</div>}
        </div>

        <div className="field">
          <label className="label">Fecha del evento</label>
          <input
            type="date"
            name="eventDate"
            className={`input ${fe.eventDate ? "input-error" : ""}`}
            defaultValue={initial?.eventDate ? initial.eventDate.slice(0, 10) : ""}
          />
        </div>

        <div className="field">
          <label className="label">Disciplina</label>
          <input
            name="discipline"
            className={`input ${fe.discipline ? "input-error" : ""}`}
            placeholder="Running, trail, ciclismo…"
            defaultValue={initial?.discipline ?? ""}
          />
        </div>

        <div className="field full">
          <label className="label">Ubicación</label>
          <input
            name="location"
            className={`input ${fe.location ? "input-error" : ""}`}
            placeholder="Buenos Aires, Argentina"
            defaultValue={initial?.location ?? ""}
          />
        </div>

        <div className="field">
          <label className="label">Precio por foto (ARS)</label>
          <input
            type="number"
            name="pricePerPhoto"
            className={`input ${fe.pricePerPhoto ? "input-error" : ""}`}
            placeholder="2400"
            min={0}
            step="100"
            defaultValue={initial?.pricePerPhoto ?? 2400}
            required
          />
          {fe.pricePerPhoto && <div className="field-error"><i className="ti ti-alert-circle" />{fe.pricePerPhoto}</div>}
        </div>

        <div className="field full">
          <label className="label">Descripción (opcional)</label>
          <textarea
            name="description"
            className={`input ${fe.description ? "input-error" : ""}`}
            placeholder="Detalles del recorrido, organización, horarios…"
            defaultValue={initial?.description ?? ""}
            rows={3}
          />
        </div>
      </div>

      {state.error && !state.fieldErrors && (
        <div className="field-error" style={{ marginTop: 16, padding: "10px 14px", border: "1px solid rgba(224,85,85,0.4)", borderRadius: 8 }}>
          <i className="ti ti-alert-circle" />
          {state.error}
        </div>
      )}

      <div className="ob-actions">
        <Link href="/dashboard/events" className="btn btn-ghost btn-back">
          <i className="ti ti-arrow-left" />
          Cancelar
        </Link>
        <button type="submit" className="btn btn-primary btn-lg" disabled={pending}>
          <span>{pending ? "Guardando…" : submitLabel}</span>
          <i className="ti ti-arrow-right" />
        </button>
      </div>
    </form>
  );
}
