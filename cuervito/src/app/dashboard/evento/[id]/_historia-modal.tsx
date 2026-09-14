"use client";

import Link from "next/link";
import { Download, RefreshCw, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type Foto = { id: string; url: string };

type Estado =
  | { tipo: "cargando" }
  | { tipo: "sin-fotos" }
  | { tipo: "generando" }
  | { tipo: "lista"; url: string }
  | { tipo: "error"; mensaje: string };

/**
 * "Subí una a tu historia", apenas termina de subir.
 *
 * Es el momento: acaba de subir las fotos, está en la pantalla del evento, y
 * lo que decide si ese evento vende es que la gente sepa que las fotos
 * existen. Una historia en Instagram con una de esas fotos y el link es la
 * forma más corta de avisar, y armarla a mano es lo que casi nadie hace.
 *
 * Así que no se le pide nada: se elige una foto al azar entre las que ya
 * tienen preview, se arma la historia con el mismo endpoint que usa el
 * estudio, y se le muestra lista para bajar. Si no le gusta la foto, "Otra"
 * elige otra. Si quiere elegir a mano, el estudio está a un click.
 *
 * Las fotos recién subidas tardan un rato en procesarse (unas treinta por
 * minuto), así que puede pasar que ninguna de la tanda esté lista todavía. Ahí
 * se usa cualquier foto del evento que sí lo esté —es el mismo evento— y si no
 * hay ninguna, se dice y se ofrece probar de nuevo.
 */
export function HistoriaModal({
  eventId,
  eventoNombre,
  alCerrar,
}: {
  eventId: string;
  eventoNombre: string;
  alCerrar: () => void;
}) {
  const [estado, setEstado] = useState<Estado>({ tipo: "cargando" });
  const fotos = useRef<Foto[]>([]);
  const usadas = useRef<Set<string>>(new Set());
  // El blob anterior se libera a mano: cada historia son ~400 KB y sin esto
  // cada "Otra" deja la anterior viva en memoria hasta cerrar la pestaña.
  const blobAnterior = useRef<string | null>(null);

  // Es un diálogo: tapa lo de atrás, se cierra con Escape. Misma mecánica que
  // el resto del panel (:root[data-modal="open"]).
  useEffect(() => {
    document.documentElement.dataset.modal = "open";
    const alTecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") alCerrar();
    };
    window.addEventListener("keydown", alTecla);
    return () => {
      window.removeEventListener("keydown", alTecla);
      document.documentElement.dataset.modal = "";
      if (blobAnterior.current) URL.revokeObjectURL(blobAnterior.current);
    };
  }, [alCerrar]);

  const generar = useCallback(async () => {
    // Una que no se haya mostrado ya; cuando se agotan, se vuelve a empezar.
    let libres = fotos.current.filter((f) => !usadas.current.has(f.id));
    if (libres.length === 0) {
      usadas.current.clear();
      libres = fotos.current;
    }
    const foto = libres[Math.floor(Math.random() * libres.length)];
    if (!foto) {
      setEstado({ tipo: "sin-fotos" });
      return;
    }
    usadas.current.add(foto.id);
    setEstado({ tipo: "generando" });

    try {
      const r = await fetch("/api/dashboard/historias", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ photoId: foto.id, plantilla: "cubierta", formato: "historia" }),
      });
      if (!r.ok) {
        const d = (await r.json().catch(() => ({}))) as { error?: string };
        setEstado({ tipo: "error", mensaje: d.error ?? "No se pudo armar la historia." });
        return;
      }
      const url = URL.createObjectURL(await r.blob());
      if (blobAnterior.current) URL.revokeObjectURL(blobAnterior.current);
      blobAnterior.current = url;
      setEstado({ tipo: "lista", url });
    } catch {
      setEstado({ tipo: "error", mensaje: "Se cortó la conexión. Probá de nuevo." });
    }
  }, []);

  const cargar = useCallback(async () => {
    setEstado({ tipo: "cargando" });
    try {
      const r = await fetch(`/api/dashboard/historias/fotos?eventId=${eventId}`);
      if (!r.ok) {
        setEstado({ tipo: "error", mensaje: "No pudimos leer las fotos del evento." });
        return;
      }
      const d = (await r.json()) as { fotos: Foto[] };
      fotos.current = d.fotos;
      if (d.fotos.length === 0) {
        setEstado({ tipo: "sin-fotos" });
        return;
      }
      await generar();
    } catch {
      setEstado({ tipo: "error", mensaje: "Se cortó la conexión. Probá de nuevo." });
    }
  }, [eventId, generar]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const lista = estado.tipo === "lista";

  return (
    <div
      className="modal"
      role="dialog"
      aria-modal="true"
      aria-label="Subí una foto a tu historia"
      onClick={(e) => {
        if (e.target === e.currentTarget) alCerrar();
      }}
    >
      <div className="modal-caja" style={{ maxWidth: 440 }}>
        <div className="modal-h">
          <div>
            <h2>
              <Sparkles style={{ width: 16, height: 16, verticalAlign: -2, marginRight: 6 }} />
              Subí una a tu historia
            </h2>
            <div className="sub">
              Armamos una historia con una foto de <b>{eventoNombre}</b>. Publicala: es lo
              que hace que la gente sepa que las fotos ya están.
            </div>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            onClick={alCerrar}
            aria-label="Cerrar"
          >
            <X />
          </button>
        </div>

        <div className="modal-b">
          {/* 9:16, como la historia. Con un alto tope para que en una laptop
              chica no se coma la pantalla entera. */}
          <div
            style={{
              aspectRatio: "9 / 16",
              maxHeight: "52dvh",
              margin: "0 auto",
              borderRadius: "var(--r-2, 12px)",
              overflow: "hidden",
              background: "var(--paper-3, #f0efe9)",
              display: "grid",
              placeItems: "center",
              width: "100%",
              maxWidth: 260,
            }}
          >
            {lista ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={estado.url}
                alt="Tu historia"
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            ) : (
              <div
                style={{
                  padding: 20,
                  textAlign: "center",
                  fontSize: 13,
                  lineHeight: 1.5,
                  color: "var(--ink-3)",
                }}
              >
                {estado.tipo === "cargando" || estado.tipo === "generando"
                  ? "Armando tu historia…"
                  : estado.tipo === "sin-fotos"
                    ? "Tus fotos todavía se están procesando. En un ratito vas a poder armarla."
                    : estado.mensaje}
              </div>
            )}
          </div>
        </div>

        <div className="modal-f" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
          <Link href="/dashboard/historias" className="btn btn-ghost btn-sm">
            Elegir yo la foto
          </Link>
          <div style={{ display: "flex", gap: "var(--s-2)" }}>
            {estado.tipo === "sin-fotos" || estado.tipo === "error" ? (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => void cargar()}>
                <RefreshCw /> Probar de nuevo
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => void generar()}
                disabled={!lista}
              >
                <RefreshCw /> Otra foto
              </button>
            )}
            {lista ? (
              <a
                className="btn btn-pri btn-sm"
                href={estado.url}
                download={`historia-${eventoNombre}.jpg`}
              >
                <Download /> Descargar
              </a>
            ) : (
              <button type="button" className="btn btn-pri btn-sm" disabled>
                <Download /> Descargar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
