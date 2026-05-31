"use client";

import { useState } from "react";

import type { EventFormState } from "../actions";
import { DeleteEventDialog } from "./delete-event-dialog";
import { EventCover } from "./event-cover";
import { EventGallerySection } from "./event-gallery-section";
import { EventInfoSection } from "./event-info-section";
import { EventMonetizationSection } from "./event-monetization-section";

type EventData = {
  id: string;
  name: string;
  description: string | null;
  discipline: string | null;
  location: string | null;
  eventDate: string | null;
  status: string;
  pricePerPhoto: number;
  coverUrl: string | null;
  photosCount: number;
  salesCount: number;
  isPublished: boolean;
};

type PhotoTile = {
  id: string;
  filename: string;
  fileSize: number | null;
  previewUrl: string;
  bibNumbers: string | null;
  width: number | null;
  height: number | null;
};

type Tab = "galeria" | "monetizacion" | "info";

export function EventDetailShell({
  event,
  publicPath,
  photos,
  maxPhotoBytes,
  updateAction,
  archiveAction,
  deleteAction,
  togglePublishedAction,
}: {
  event: EventData;
  publicPath: string | null;
  photos: PhotoTile[];
  maxPhotoBytes: number;
  updateAction: (state: EventFormState, fd: FormData) => Promise<EventFormState>;
  archiveAction: () => Promise<void>;
  deleteAction: () => Promise<void>;
  togglePublishedAction: () => Promise<void>;
}) {
  const [tab, setTab] = useState<Tab>("galeria");

  const dateLabel = event.eventDate
    ? new Date(event.eventDate).toLocaleDateString("es-AR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "Fecha por definir";

  return (
    <main className="wrap ev-detail">
      <EventCover
        eventId={event.id}
        title={event.name}
        date={dateLabel}
        location={event.location}
        discipline={event.discipline}
        status={event.status}
        coverUrl={event.coverUrl}
        publicPath={event.isPublished ? publicPath : null}
      />

      {/* Publish toggle banner */}
      <div
        style={{
          background: event.isPublished ? "var(--bg-surface)" : "var(--accent-deep)",
          border: `1px solid ${event.isPublished ? "var(--border-subtle)" : "var(--border-accent)"}`,
          borderRadius: 12,
          padding: "14px 18px",
          marginBottom: 18,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontWeight: 500, fontSize: 14 }}>
            {event.isPublished
              ? "✅ Evento publicado — visible al público"
              : "Evento todavía sin publicar"}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--text-tertiary)", marginTop: 2 }}>
            {event.isPublished
              ? "Cualquiera puede entrar al link público y comprar fotos."
              : "Activá la publicación cuando estés listo para vender."}
          </div>
        </div>
        <form action={togglePublishedAction}>
          <button
            type="submit"
            className={event.isPublished ? "btn btn-outline" : "btn btn-primary"}
          >
            {event.isPublished ? "Despublicar" : "Publicar evento"}
          </button>
        </form>
      </div>

      {/* Toggle cards */}
      <div className="toggle-cards" role="tablist">
        <button
          type="button"
          className={`tc ${tab === "galeria" ? "active" : ""}`}
          onClick={() => setTab("galeria")}
          role="tab"
        >
          <div className="tc-icon">
            <i className="ti ti-photo" />
          </div>
          <div>
            <div className="tc-title">Galería</div>
            <div className="tc-sub">
              {event.photosCount > 0
                ? `${event.photosCount.toLocaleString("es-AR")} fotos`
                : "Subí las fotos del evento"}
            </div>
          </div>
        </button>

        <button
          type="button"
          className={`tc ${tab === "monetizacion" ? "active" : ""}`}
          onClick={() => setTab("monetizacion")}
          role="tab"
        >
          <div className="tc-icon">
            <i className="ti ti-coin" />
          </div>
          <div>
            <div className="tc-title">Monetización</div>
            <div className="tc-sub">Ventas, precio y descuentos</div>
          </div>
        </button>

        <button
          type="button"
          className={`tc ${tab === "info" ? "active" : ""}`}
          onClick={() => setTab("info")}
          role="tab"
        >
          <div className="tc-icon">
            <i className="ti ti-info-circle" />
          </div>
          <div>
            <div className="tc-title">Info</div>
            <div className="tc-sub">Título, fecha y descripción</div>
          </div>
        </button>
      </div>

      {/* Sections */}
      <section className={`section ${tab === "galeria" ? "active" : ""}`}>
        <EventGallerySection
          eventId={event.id}
          photosCount={event.photosCount}
          photos={photos}
          maxPhotoBytes={maxPhotoBytes}
        />
      </section>

      <section className={`section ${tab === "monetizacion" ? "active" : ""}`}>
        <EventMonetizationSection
          eventId={event.id}
          revenue={0}
          photosSold={event.salesCount}
          conversion={null}
          pricePerPhoto={event.pricePerPhoto}
        />
      </section>

      <section className={`section ${tab === "info" ? "active" : ""}`}>
        <EventInfoSection
          event={event}
          updateAction={updateAction}
          archiveAction={archiveAction}
          deleteSlot={
            <DeleteEventDialog eventName={event.name} action={deleteAction} />
          }
        />
      </section>
    </main>
  );
}
