"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { createEventAction, type EventFormState } from "../actions";

export function NewEventShell() {
  const [state, formAction, pending] = useActionState<EventFormState, FormData>(
    createEventAction,
    { error: null },
  );
  const fe = state.fieldErrors ?? {};

  // Controlled inputs so the preview reflects what the photographer types
  // in real time. On submit these still go through FormData via `name` attrs.
  const [name, setName] = useState("");
  const [discipline, setDiscipline] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [location, setLocation] = useState("");
  const [pricePerPhoto, setPricePerPhoto] = useState("2400");
  const [description, setDescription] = useState("");

  const formattedDate = formatDate(eventDate);
  const priceNumber = Number(pricePerPhoto);
  const priceLabel = Number.isFinite(priceNumber) && priceNumber > 0
    ? `$${priceNumber.toLocaleString("es-AR")}`
    : "$—";

  return (
    <div className="new-event-shell">
      <form action={formAction} className="new-event-form">
        <FormSection
          title="Identidad"
          hint="Cómo va a aparecer tu evento en el buscador y en tu storefront."
        >
          <div className="new-field full">
            <label className="label" htmlFor="ne-name">Nombre del evento</label>
            <input
              id="ne-name"
              name="name"
              className={`input ${fe.name ? "input-error" : ""}`}
              placeholder="Maratón Internacional Buenos Aires"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
            {fe.name && <FieldError msg={fe.name} />}
          </div>

          <div className="new-field">
            <label className="label" htmlFor="ne-discipline">Disciplina</label>
            <input
              id="ne-discipline"
              name="discipline"
              className={`input ${fe.discipline ? "input-error" : ""}`}
              placeholder="Running, trail, ciclismo…"
              value={discipline}
              onChange={(e) => setDiscipline(e.target.value)}
            />
          </div>
        </FormSection>

        <FormSection
          title="Cuándo y dónde"
          hint="Se usa para ordenar por fecha y filtrar por ciudad."
        >
          <div className="new-field">
            <label className="label" htmlFor="ne-date">Fecha del evento</label>
            <input
              id="ne-date"
              type="date"
              name="eventDate"
              className={`input ${fe.eventDate ? "input-error" : ""}`}
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
            />
          </div>

          <div className="new-field full">
            <label className="label" htmlFor="ne-location">Ubicación</label>
            <input
              id="ne-location"
              name="location"
              className={`input ${fe.location ? "input-error" : ""}`}
              placeholder="Buenos Aires, Argentina"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
        </FormSection>

        <FormSection
          title="Precio"
          hint="Es el precio default por foto. Podés cambiarlo por foto después."
        >
          <div className="new-field">
            <label className="label" htmlFor="ne-price">Precio por foto (ARS)</label>
            <div className="input-with-prefix">
              <span className="prefix">$</span>
              <input
                id="ne-price"
                type="number"
                name="pricePerPhoto"
                className={`input ${fe.pricePerPhoto ? "input-error" : ""}`}
                placeholder="2400"
                min={0}
                step="100"
                value={pricePerPhoto}
                onChange={(e) => setPricePerPhoto(e.target.value)}
                required
              />
            </div>
            {fe.pricePerPhoto && <FieldError msg={fe.pricePerPhoto} />}
          </div>
        </FormSection>

        <FormSection
          title="Descripción"
          hint="Opcional. Se muestra abajo del hero en la página pública."
        >
          <div className="new-field full">
            <textarea
              name="description"
              className={`input ${fe.description ? "input-error" : ""}`}
              placeholder="Detalles del recorrido, organización, horarios…"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </FormSection>

        {state.error && !state.fieldErrors && (
          <div
            className="field-error"
            style={{
              marginTop: 4,
              padding: "12px 14px",
              border: "1px solid rgba(224,85,85,0.4)",
              borderRadius: 8,
            }}
          >
            <i className="ti ti-alert-circle" />
            {state.error}
          </div>
        )}

        <div className="new-event-actions">
          <Link href="/dashboard/events" className="btn btn-ghost">
            <i className="ti ti-arrow-left" />
            Cancelar
          </Link>
          <button type="submit" className="btn btn-primary btn-lg" disabled={pending}>
            <span>{pending ? "Creando…" : "Crear evento"}</span>
            {!pending && <i className="ti ti-arrow-right" />}
          </button>
        </div>
      </form>

      <aside className="new-event-preview" aria-label="Vista previa del evento">
        <div className="preview-eyebrow">
          <i className="ti ti-eye" />
          Preview
        </div>
        <div className="preview-note">
          Así se va a ver tu evento en el buscador público.
        </div>

        <div className="preview-card">
          <div className="preview-cover">
            <div className="preview-cover-fallback" aria-hidden>
              <i className="ti ti-photo" />
              <span>Vas a poder subir la portada después</span>
            </div>
            {discipline && (
              <span className="preview-discipline">{discipline.trim()}</span>
            )}
          </div>
          <div className="preview-body">
            <div className="preview-title">
              {name.trim() || <span className="placeholder">Nombre del evento</span>}
            </div>
            <div className="preview-meta">
              <span>
                <i className="ti ti-calendar-event" />
                {formattedDate || <span className="placeholder">Fecha por definir</span>}
              </span>
              <span className="dot" />
              <span>
                <i className="ti ti-map-pin" />
                {location.trim() || <span className="placeholder">Ubicación</span>}
              </span>
            </div>
            <div className="preview-price">
              <span className="lbl">Precio por foto</span>
              <span className="amt">{priceLabel}</span>
            </div>
          </div>
        </div>

        {description.trim() && (
          <div className="preview-desc">
            <div className="preview-desc-lbl">Descripción</div>
            <p>{description}</p>
          </div>
        )}
      </aside>
    </div>
  );
}

function FormSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="new-form-section">
      <header>
        <h3>{title}</h3>
        {hint && <p>{hint}</p>}
      </header>
      <div className="new-form-grid">{children}</div>
    </section>
  );
}

function FieldError({ msg }: { msg: string }) {
  return (
    <div className="field-error">
      <i className="ti ti-alert-circle" />
      {msg}
    </div>
  );
}

function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso + "T12:00:00");
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
