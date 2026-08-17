"use client";

import { CircleCheck, Clock, Download, Package } from "lucide-react";
import { useState } from "react";

import { Velo } from "./velo";

type Foto = { id: string; filename: string; bibNumbers: string | null; previewUrl: string };

/**
 * La entrega: lo que ve el atleta después de pagar.
 *
 * Usa las mismas piezas que la página de venta (.et-*) porque es la misma
 * persona diez segundos más tarde. Si acá cambian la tipografía, los botones y
 * los colores, por un momento no sabe si sigue en el mismo lugar.
 *
 * Bajar todo va primero y con el botón lleno: es lo que viene a hacer casi
 * todo el mundo. La grilla de abajo es para el que quiere una sola, o para el
 * que quiere mirarlas antes de bajar 80 MB por datos móviles.
 */
export function Entrega({
  token,
  comprador,
  evento,
  fotos,
  vence,
  recienPagado,
}: {
  token: string;
  comprador: string;
  evento: string;
  fotos: Foto[];
  vence: string | null;
  recienPagado: boolean;
}) {
  const [velo, setVelo] = useState(recienPagado);
  const [bajadas, setBajadas] = useState<Set<string>>(new Set());
  const [zipEnCurso, setZipEnCurso] = useState(false);

  async function bajarUna(f: Foto) {
    try {
      // Por el mismo origen: el fetch de Safari en iOS contra una URL de otro
      // origen sin cabeceras CORS tira excepción, y ahí la descarga muere sin
      // decir nada. El endpoint hace de puente.
      const r = await fetch(`/api/download/${token}/${f.id}/blob`);
      if (!r.ok) throw new Error();
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = f.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setBajadas((s) => new Set(s).add(f.id));
    } catch {
      // Si el puente falla, se abre en una pestaña: peor que bajar, mejor que
      // no poder llevarse la foto.
      window.open(`/api/download/${token}/${f.id}`, "_blank", "noopener");
    }
  }

  function bajarTodo() {
    setZipEnCurso(true);
    // El zip lo arma el servidor y puede tardar: se navega y el navegador se
    // encarga. Con fetch + blob habría que tener las 80 MB en memoria antes de
    // escribir el archivo.
    window.location.href = `/api/download/${token}/zip`;
    setTimeout(() => setZipEnCurso(false), 4000);
  }

  return (
    <div className="et">
      {velo && <Velo alTerminar={() => setVelo(false)} />}

      <div className="et-in">
        <section className="eg-hero">
          <div className="eg-hero-i">
            <CircleCheck />
          </div>
          <h1>Listo, {comprador.split(" ")[0]}. Son tuyas.</h1>
          <p>
            {fotos.length === 1 ? "Tu foto" : `Tus ${fotos.length} fotos`} de <b>{evento}</b>, sin
            marca de agua y en calidad original. También te las mandamos por mail.
          </p>
        </section>

        <section className="eg-acciones">
          <div className="eg-acciones-t">
            <b>Bajar todo</b>
            <span>
              Un archivo .zip con {fotos.length === 1 ? "la foto" : `las ${fotos.length} fotos`}
            </span>
          </div>
          <button className="et-btn et-btn-lleno" onClick={bajarTodo} disabled={zipEnCurso}>
            <Package /> {zipEnCurso ? "Preparando…" : "Bajar todo"}
          </button>
        </section>

        {/* El link vence, y se dice en la pantalla donde se descarga y no sólo
            en el mail: quien vuelve un mes después no busca el mail, abre el
            link que tenía guardado. */}
        {vence && (
          <div className="eg-vence">
            <Clock />
            <span>
              Este link funciona hasta el <b>{vence}</b>. Después escribinos y te damos uno nuevo.
            </span>
          </div>
        )}

        <section className="et-grilla">
          {fotos.map((f) => {
            const lista = bajadas.has(f.id);
            return (
              <div className="et-foto" key={f.id}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.previewUrl} alt="" loading="lazy" />
                {f.bibNumbers && (
                  <span className="et-foto-dorsal">#{f.bibNumbers.split(",")[0]}</span>
                )}
                <button
                  className="eg-baja"
                  data-listo={lista ? "1" : ""}
                  onClick={() => void bajarUna(f)}
                  aria-label={`Bajar ${f.filename}`}
                >
                  {lista ? <CircleCheck /> : <Download />}
                  <span>{lista ? "Bajada" : "Bajar"}</span>
                </button>
              </div>
            );
          })}
        </section>
      </div>

      <footer className="et-pie">
        <span>Guardá este link: podés volver a bajarlas mientras esté vigente.</span>
        <a href="https://encontrate.app" target="_blank" rel="noopener">
          Hecho con encontrate.app
        </a>
      </footer>
    </div>
  );
}
