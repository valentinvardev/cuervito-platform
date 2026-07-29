"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";

import { DateInput } from "~/app/_components/date-input";

import { createEventAction, type EventFormState } from "../actions";

const COVER_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function NewEventShell() {
  const router = useRouter();
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

  // Portada staged en cliente. Se sube después de que el server action
  // devuelve el eventId (no podemos armar el S3 key sin ese id).
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);

  useEffect(() => {
    if (!coverFile) {
      setCoverPreview(null);
      return;
    }
    const url = URL.createObjectURL(coverFile);
    setCoverPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [coverFile]);

  function pickCover(f: File) {
    setCoverError(null);
    if (!COVER_MIME[f.type]) {
      setCoverError("Solo JPG, PNG o WebP.");
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setCoverError("Máximo 10 MB.");
      return;
    }
    setCoverFile(f);
  }

  // Al recibir eventId, si hay portada la subimos y después redirigimos.
  useEffect(() => {
    if (!state.eventId) return;
    let cancelled = false;
    (async () => {
      if (coverFile) {
        setUploadingCover(true);
        try {
          const fd = new FormData();
          fd.append("cover", coverFile);
          await fetch(`/api/dashboard/events/${state.eventId}/cover`, {
            method: "POST",
            body: fd,
          });
        } catch (err) {
          console.error("[new-event] cover upload failed:", err);
        } finally {
          if (!cancelled) setUploadingCover(false);
        }
      }
      if (!cancelled) router.push(`/dashboard/events/${state.eventId}`);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.eventId]);

  const formattedDate = formatDate(eventDate);
  const priceNumber = Number(pricePerPhoto);
  const priceLabel = Number.isFinite(priceNumber) && priceNumber > 0
    ? `$${priceNumber.toLocaleString("es-AR")}`
    : "$—";

  return (
    <div className="new-event-shell">
      <form action={formAction} className="new-event-form">
        <FormSection
          icon="ti-id-badge-2"
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
          icon="ti-calendar-time"
          title="Cuándo y dónde"
          hint="Se usa para ordenar por fecha y filtrar por ciudad."
        >
          <div className="new-field">
            <label className="label" htmlFor="ne-date">Fecha del evento</label>
            <DateInput
              id="ne-date"
              name="eventDate"
              value={eventDate}
              onChange={setEventDate}
              ariaLabel="Fecha del evento"
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
          icon="ti-coin"
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
          icon="ti-photo"
          title="Portada"
          hint="Opcional. Se sube al crear el evento y aparece en el banner y en el buscador."
        >
          <div className="new-field full">
            <input
              ref={coverInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) pickCover(f);
                e.target.value = "";
              }}
            />
            {!coverFile ? (
              <button
                type="button"
                className="cover-picker-btn"
                onClick={() => coverInputRef.current?.click()}
              >
                <span className="cp-icon">
                  <i className="ti ti-photo-plus" />
                </span>
                <span>
                  <span className="cp-title">Subir portada</span>
                  <span className="cp-sub">JPG, PNG o WebP · hasta 10 MB</span>
                </span>
              </button>
            ) : (
              <div className="cover-picker-selected">
                {coverPreview && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={coverPreview} alt="Portada elegida" />
                )}
                <div className="cps-info">
                  <div className="cps-name">{coverFile.name}</div>
                  <div className="cps-meta">
                    {(coverFile.size / 1024).toLocaleString("es-AR", {
                      maximumFractionDigits: 0,
                    })}{" "}
                    KB
                  </div>
                </div>
                <div className="cps-actions">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => coverInputRef.current?.click()}
                  >
                    Cambiar
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setCoverFile(null)}
                    style={{ color: "var(--error)" }}
                  >
                    Quitar
                  </button>
                </div>
              </div>
            )}
            {coverError && <FieldError msg={coverError} />}
          </div>
        </FormSection>

        <FormSection
          icon="ti-align-left"
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
          <button
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={pending || uploadingCover}
          >
            <span>
              {uploadingCover
                ? "Subiendo portada…"
                : pending
                  ? "Creando…"
                  : "Crear evento"}
            </span>
            {!pending && !uploadingCover && <i className="ti ti-arrow-right" />}
          </button>
        </div>
      </form>

      <aside className="new-event-preview" aria-label="Vista previa del evento">
        <div className="preview-eyebrow">
          <i className="ti ti-eye" />
          Vista previa
        </div>
        <div className="preview-note">
          Así se va a ver tu evento en el buscador público.
        </div>

        <div className="preview-card">
          <div
            className="preview-cover"
            style={
              coverPreview
                ? {
                    backgroundImage: `url(${coverPreview})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }
                : undefined
            }
          >
            {!coverPreview && (
              <div className="preview-cover-fallback" aria-hidden>
                <i className="ti ti-photo" />
                <span>Elegí una portada en el bloque de arriba</span>
              </div>
            )}
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
  icon,
  title,
  hint,
  children,
}: {
  icon?: string;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="new-form-section">
      <header>
        <div className="new-form-heading">
          {icon && (
            <span className="new-form-icon">
              <i className={`ti ${icon}`} />
            </span>
          )}
          <div>
            <h3>{title}</h3>
            {hint && <p>{hint}</p>}
          </div>
        </div>
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
