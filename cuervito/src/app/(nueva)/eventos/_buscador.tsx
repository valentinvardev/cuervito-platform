"use client";

import Link from "next/link";
import { ArrowRight, Search, X } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";

import { searchLiveEvents, type LiveEvent } from "~/app/_components/live-events-actions";

/**
 * Buscar el evento, con la tarjeta de evento de la landing.
 *
 * Es el mismo buscador de antes —la misma acción del servidor, la misma
 * espera de 200 ms entre teclas— con la cara de encontrate. La tarjeta no es
 * un link entero: la acción es el botón, que se puede tabular y se lee como lo
 * que hace. La portada también lleva al evento, porque en el teléfono lo
 * primero que se toca es la foto.
 */
export function BuscadorEventos() {
  const [q, setQ] = useState("");
  const [eventos, setEventos] = useState<LiveEvent[]>([]);
  const [cargado, setCargado] = useState(false);
  const [, empezar] = useTransition();
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);
  const campo = useRef<HTMLInputElement>(null);

  function buscar(texto: string) {
    if (espera.current) clearTimeout(espera.current);
    espera.current = setTimeout(() => {
      empezar(async () => {
        setEventos(await searchLiveEvents(texto));
        setCargado(true);
      });
    }, 200);
  }

  useEffect(() => {
    buscar("");
  }, []);

  return (
    <>
      <div className="evs-buscar">
        <Search className="evs-lupa" />
        <input
          ref={campo}
          type="search"
          placeholder="Maratón, trail, ciclismo, ciudad…"
          aria-label="Buscar un evento"
          autoComplete="off"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            buscar(e.target.value);
          }}
        />
        {q && (
          <button
            type="button"
            className="evs-limpiar"
            aria-label="Borrar la búsqueda"
            onClick={() => {
              setQ("");
              buscar("");
              campo.current?.focus();
            }}
          >
            <X />
          </button>
        )}
      </div>

      <div className="evs-grilla" aria-busy={!cargado}>
        {!cargado ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="ev evs-hueso" aria-hidden="true">
              <div className="ev-cover" />
              <div className="ev-body">
                <i style={{ width: "70%" }} />
                <i style={{ width: "45%" }} />
              </div>
            </div>
          ))
        ) : eventos.length === 0 ? (
          <div className="evs-vacio">
            {q ? (
              <>
                <b>Nada con “{q}”</b>
                <span>Probá con otra parte del nombre, con la ciudad o con la disciplina.</span>
              </>
            ) : (
              <>
                <b>Todavía no hay eventos publicados</b>
                <span>Cuando tu fotógrafo publique el suyo, va a aparecer acá.</span>
              </>
            )}
          </div>
        ) : (
          eventos.map((e) => (
            <div key={e.href} className="ev">
              <Link href={e.href} className="ev-cover" tabIndex={-1} aria-hidden="true">
                {e.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={e.coverUrl} alt="" loading="lazy" />
                ) : (
                  <span>{e.name.toUpperCase()}</span>
                )}
              </Link>
              <div className="ev-body">
                <div className="t">{e.name}</div>
                <div className="m">
                  {[e.date, e.location, `${e.photos.toLocaleString("es-AR")} fotos`].filter(Boolean).join(" · ")}
                </div>
                <Link href={e.href} className="btn btn-ghost">
                  Buscar mis fotos <ArrowRight className="go" />
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
