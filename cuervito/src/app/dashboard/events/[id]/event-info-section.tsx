"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";

import type { EventFormState } from "../actions";

type EventData = {
  id: string;
  name: string;
  description: string | null;
  discipline: string | null;
  location: string | null;
  eventDate: string | null;
  status: string;
  pricePerPhoto: number;
};

export function EventInfoSection({
  event,
  updateAction,
  archiveAction,
  deleteSlot,
}: {
  event: EventData;
  updateAction: (state: EventFormState, fd: FormData) => Promise<EventFormState>;
  archiveAction: () => Promise<void>;
  deleteSlot: React.ReactNode;
}) {
  const [state, action, pending] = useActionState<EventFormState, FormData>(updateAction, {
    error: null,
  });

  const [savedToast, setSavedToast] = useState(false);
  useEffect(() => {
    if (!state.error && !state.fieldErrors && !pending && (state as { ok?: boolean }).ok !== undefined) {
      setSavedToast(true);
      const t = setTimeout(() => setSavedToast(false), 2200);
      return () => clearTimeout(t);
    }
  }, [state, pending]);

  const fe = state.fieldErrors ?? {};

  return (
    <>
      {savedToast && (
        <div
          style={{
            position: "fixed",
            top: 84,
            right: 20,
            zIndex: 60,
            padding: "10px 14px",
            background: "var(--bg-surface)",
            border: "1px solid var(--success)",
            borderRadius: 10,
            color: "var(--success)",
            fontSize: 14,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            boxShadow: "0 12px 30px rgba(0,0,0,0.4)",
          }}
        >
          <i className="ti ti-circle-check-filled" />
          Cambios guardados
        </div>
      )}

      <form action={action} className="form-card">
        <div className="form-row">
          <label>Título</label>
          <input type="text" name="name" defaultValue={event.name} required />
          {fe.name && <div style={{ color: "var(--error)", fontSize: 12, marginTop: 6 }}>{fe.name}</div>}
        </div>

        <div className="form-grid-2">
          <div className="form-row">
            <label>Fecha</label>
            <input
              type="date"
              name="eventDate"
              defaultValue={event.eventDate ? event.eventDate.slice(0, 10) : ""}
            />
          </div>
          <div className="form-row">
            <label>Ubicación</label>
            <input
              type="text"
              name="location"
              defaultValue={event.location ?? ""}
              placeholder="Buenos Aires, Argentina"
            />
          </div>
        </div>

        <div className="form-grid-2">
          <div className="form-row">
            <label>Disciplina</label>
            <input
              type="text"
              name="discipline"
              defaultValue={event.discipline ?? ""}
              placeholder="Running, trail, ciclismo…"
            />
          </div>
          <div className="form-row">
            <label>Precio por foto (ARS)</label>
            <input
              type="number"
              name="pricePerPhoto"
              defaultValue={event.pricePerPhoto}
              min={0}
              step="100"
              required
            />
            {fe.pricePerPhoto && (
              <div style={{ color: "var(--error)", fontSize: 12, marginTop: 6 }}>
                {fe.pricePerPhoto}
              </div>
            )}
          </div>
        </div>

        <div className="form-row">
          <label>Descripción</label>
          <textarea
            name="description"
            defaultValue={event.description ?? ""}
            placeholder="Contale a los corredores qué van a encontrar…"
            rows={3}
          />
        </div>

        {state.error && !state.fieldErrors && (
          <div
            style={{
              marginTop: 12,
              padding: "10px 14px",
              background: "rgba(224,85,85,0.08)",
              border: "1px solid rgba(224,85,85,0.4)",
              borderRadius: 8,
              color: "var(--error)",
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <i className="ti ti-alert-circle" />
            {state.error}
          </div>
        )}

        <div className="form-actions">
          {/* Danger zone on the far left */}
          {deleteSlot}
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => {
              if (confirm("¿Archivar el evento? Lo sacamos del listado activo.")) {
                void archiveAction();
              }
            }}
          >
            Archivar
          </button>
          <Link href="/dashboard/events" className="btn btn-outline">
            Cancelar
          </Link>
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </form>
    </>
  );
}
