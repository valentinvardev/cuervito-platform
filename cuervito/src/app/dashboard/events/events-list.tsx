"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Item = {
  id: string;
  slug: string;
  name: string;
  eventDate: string | null;
  location: string | null;
  discipline: string | null;
  status: string;
  photos: number;
  sales: number;
};

function formatDate(iso: string | null): string {
  if (!iso) return "Sin fecha";
  const d = new Date(iso);
  return d.toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" });
}

function statusPill(status: string) {
  if (status === "PROCESSING") {
    return (
      <span className="status-pill processing">
        <span className="spin-ring" />
        Procesando
      </span>
    );
  }
  if (status === "ACTIVE" || status === "FINISHED") {
    return (
      <span className="status-pill uploaded">
        <i className="ti ti-circle-check-filled" />
        Subido
      </span>
    );
  }
  return (
    <span className="status-pill draft">
      <i className="ti ti-pencil" />
      Borrador
    </span>
  );
}

export function EventsList({ events }: { events: Item[] }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return events;
    return events.filter((e) =>
      [e.name, e.location, e.discipline].some((s) => s?.toLowerCase().includes(term)),
    );
  }, [q, events]);

  return (
    <>
      <div className="filters">
        <div className="search">
          <i className="ti ti-search" />
          <input
            placeholder="Buscar por nombre o ubicación…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      <div className="event-list">
        {filtered.map((e) => (
          <Link key={e.id} href={`/dashboard/events/${e.id}`} className="event-item">
            <div className="ev-thumb">
              <i className="ti ti-photo" />
            </div>
            <div className="ev-info">
              <div className="title">{e.name}</div>
              <div className="sub">
                <span>{formatDate(e.eventDate)}</span>
                {e.location && (
                  <>
                    <span className="sep" />
                    <span>{e.location}</span>
                  </>
                )}
                <span className="sep" />
                <span>{e.photos.toLocaleString("es-AR")} fotos</span>
                <span className="sep" />
                {statusPill(e.status)}
              </div>
            </div>
            <div className="ev-revenue">
              <div className="amt">
                {e.sales > 0 ? `${e.sales} ventas` : "—"}
              </div>
              <div className="photos">{e.photos.toLocaleString("es-AR")} fotos</div>
            </div>
            <i className="ti ti-chevron-right ev-arrow" />
          </Link>
        ))}
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "32px 16px", color: "var(--text-tertiary)", fontSize: 14 }}>
            No encontramos eventos con ese término.
          </div>
        )}
      </div>
    </>
  );
}
