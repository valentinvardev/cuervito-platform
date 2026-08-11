"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";

import { searchLiveEvents, type LiveEvent } from "./live-events-actions";

/**
 * Carril rápido del atleta, arriba de todo.
 *
 * La home es la página del fotógrafo: el que viene a buscar sus fotos no
 * tiene por qué leerla. Esta barra le da el buscador en el primer pixel,
 * sin scroll, reusando la misma server action que la grilla de /eventos.
 */
export function AthleteSearchBar() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<LiveEvent[] | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Cerrar el panel al clickear afuera o con Escape.
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  function run(query: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        setResults(await searchLiveEvents(query));
      });
    }, 200);
  }

  const showPanel = open && (results !== null || pending);

  return (
    <div className="athlete-bar">
      <div className="container athlete-bar-inner">
        <span className="ab-label">
          <i className="ti ti-run" aria-hidden="true" />
          ¿Buscás tus fotos de una carrera?
        </span>

        <div className="ab-search-wrap" ref={wrapRef}>
          <div className={`ab-search ${showPanel ? "is-open" : ""}`}>
            <i className="ti ti-search" aria-hidden="true" />
            <input
              type="search"
              value={q}
              placeholder="Nombre del evento o ciudad…"
              aria-label="Buscar mi evento"
              autoComplete="off"
              onFocus={() => {
                setOpen(true);
                if (results === null) run(q);
              }}
              onChange={(e) => {
                setQ(e.target.value);
                setOpen(true);
                run(e.target.value);
              }}
            />
            {pending && <span className="ab-spinner" aria-hidden="true" />}
          </div>

          {showPanel && (
            <div className="ab-pop">
              {results && results.length > 0 ? (
                <>
                  {results.slice(0, 6).map((e) => (
                    <Link key={e.href} href={e.href} className="ab-row">
                      <span
                        className="ab-thumb"
                        style={
                          e.coverUrl
                            ? { backgroundImage: `url(${e.coverUrl})` }
                            : undefined
                        }
                        aria-hidden="true"
                      />
                      <span className="ab-info">
                        <span className="ab-name">{e.name}</span>
                        <span className="ab-meta">
                          {[e.date, e.location].filter(Boolean).join(" · ") ||
                            "Evento publicado"}
                        </span>
                      </span>
                      <span className="ab-count">
                        {e.photos.toLocaleString("es-AR")} fotos
                      </span>
                    </Link>
                  ))}
                  <Link href="/eventos" className="ab-all">
                    Ver todos los eventos
                    <i className="ti ti-arrow-right" aria-hidden="true" />
                  </Link>
                </>
              ) : results ? (
                <div className="ab-empty">
                  <span>
                    No encontramos un evento con ese nombre. Puede que el
                    fotógrafo todavía no haya publicado las fotos.
                  </span>
                  <Link href="/eventos" className="ab-all">
                    Ver todos los eventos
                    <i className="ti ti-arrow-right" aria-hidden="true" />
                  </Link>
                </div>
              ) : (
                <div className="ab-empty">
                  <span>Buscando…</span>
                </div>
              )}
            </div>
          )}
        </div>

        <Link href="/eventos" className="ab-link">
          Ver todos
          <i className="ti ti-arrow-right" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
