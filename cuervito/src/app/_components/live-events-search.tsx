"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";

import { searchLiveEvents, type LiveEvent } from "./live-events-actions";

export function LiveEventsSearch() {
  const [q, setQ] = useState("");
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function run(query: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        const res = await searchLiveEvents(query);
        setEvents(res);
      });
    }, 200);
  }

  useEffect(() => {
    run("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <div
        className={`le-search reveal ${q ? "has-text" : ""}`}
        style={{ ["--reveal-delay" as string]: "100ms" }}
      >
        <i className="ti ti-search"></i>
        <input
          placeholder="Maratón, trail, ciclismo, ciudad…"
          autoComplete="off"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            run(e.target.value);
          }}
        />
        {q && (
          <button
            className="clear"
            type="button"
            onClick={() => {
              setQ("");
              run("");
            }}
            aria-label="Limpiar"
          >
            <i className="ti ti-x" style={{ fontSize: 16 }}></i>
          </button>
        )}
      </div>

      <div
        className="le-grid reveal"
        style={{ ["--reveal-delay" as string]: "180ms" }}
      >
        {events.length === 0 ? (
          <div className="le-empty">
            {q ? (
              <>
                Sin resultados para <strong>&quot;{q}&quot;</strong>.
              </>
            ) : (
              <>Todavía no hay eventos publicados.</>
            )}
          </div>
        ) : (
          events.map((e) => (
            <Link key={e.href} className="le-card" href={e.href}>
              <div
                className="le-card-cover"
                style={
                  e.coverUrl
                    ? {
                        backgroundImage: `url(${e.coverUrl})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }
                    : {
                        background:
                          "linear-gradient(135deg, rgba(245,130,10,0.3) 0%, rgba(245,130,10,0.05) 60%, rgba(15,13,11,1) 100%)",
                      }
                }
              ></div>
              <div className="le-card-body">
                <div className="ttl">{e.name}</div>
                <div className="meta">
                  {e.date && <span>{e.date}</span>}
                  {e.date && e.location && <span className="sep"></span>}
                  {e.location && <span>{e.location}</span>}
                </div>
                <div className="photos">
                  {e.photos.toLocaleString("es-AR")} fotos
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </>
  );
}
