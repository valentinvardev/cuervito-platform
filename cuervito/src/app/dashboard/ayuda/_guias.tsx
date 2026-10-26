"use client";

import { ArrowLeft, ArrowRight, ScanFace, Upload, Wallet, X } from "lucide-react";
import { useEffect, useState } from "react";

import { whatsappUrl } from "~/lib/support";

import { GUIAS, type GuiaId } from "./guias";

const ICONOS = { subir: Upload, reconocimiento: ScanFace, pagos: Wallet } as const;

/**
 * Las guías de Ayuda, cada una en un diálogo.
 *
 * Eran tres tarjetas con un link que volvía a la misma página: se tocaban y
 * no pasaba nada. Ahora abren la guía encima, sin salir de Ayuda, con el fondo
 * desenfocado para que lo que se lee sea lo único nítido. Se pasa de una a la
 * siguiente desde el pie, porque quien lee "subir un evento" casi siempre
 * sigue con "cómo funciona el reconocimiento".
 */
export function Guias() {
  const [abierta, setAbierta] = useState<GuiaId | null>(null);

  const i = GUIAS.findIndex((g) => g.id === abierta);
  const guia = i >= 0 ? GUIAS[i] : null;
  const anterior = i > 0 ? GUIAS[i - 1] : null;
  const siguiente = i >= 0 && i < GUIAS.length - 1 ? GUIAS[i + 1] : null;

  useEffect(() => {
    if (!abierta) return;
    document.documentElement.dataset.modal = "open";
    const alTecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierta(null);
    };
    window.addEventListener("keydown", alTecla);
    return () => {
      window.removeEventListener("keydown", alTecla);
      document.documentElement.dataset.modal = "";
    };
  }, [abierta]);

  // Al cambiar de guía desde el pie, el cuerpo vuelve arriba: si no, la
  // siguiente arranca por la mitad, donde quedó el scroll de la anterior.
  useEffect(() => {
    document.querySelector(".modal-caja.guia .modal-b")?.scrollTo({ top: 0 });
  }, [abierta]);

  return (
    <>
      <div className="guias">
        {GUIAS.map((g) => {
          const Icono = ICONOS[g.id];
          return (
            <button type="button" className="gu" key={g.id} onClick={() => setAbierta(g.id)}>
              <span className="gu-i">
                <Icono />
              </span>
              <b>{g.titulo}</b>
              <p>{g.resumen}</p>
              <span className="mas">
                Leer <ArrowRight />
              </span>
            </button>
          );
        })}
      </div>

      {guia && (
        <div
          className="modal vidrio"
          role="dialog"
          aria-modal="true"
          aria-labelledby="guia-titulo"
          onClick={(e) => {
            if (e.target === e.currentTarget) setAbierta(null);
          }}
        >
          <div className="modal-caja guia">
            <div className="modal-h guia-h">
              <div className="guia-h-t">
                <span className="gu-i">
                  {(() => {
                    const Icono = ICONOS[guia.id];
                    return <Icono />;
                  })()}
                </span>
                <div>
                  <div className="guia-sobre">
                    Guía {i + 1} de {GUIAS.length}
                  </div>
                  <h2 id="guia-titulo">{guia.titulo}</h2>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                onClick={() => setAbierta(null)}
                aria-label="Cerrar"
              >
                <X />
              </button>
            </div>

            <div className="modal-b guia-cuerpo">
              <p className="guia-lede">{guia.lede}</p>

              {guia.secciones.map((s) => (
                <section key={s.titulo}>
                  <h3>{s.titulo}</h3>
                  {s.texto && <p>{s.texto}</p>}
                  {s.pasos && (
                    <ol className="guia-pasos">
                      {s.pasos.map((p) => (
                        <li key={p.titulo}>
                          <b>{p.titulo}</b>
                          <span>{p.texto}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                  {s.lista && (
                    <ul className="guia-puntos">
                      {s.lista.map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                  )}
                  {s.tip && <div className="guia-tip">{s.tip}</div>}
                </section>
              ))}
            </div>

            <div className="modal-f guia-f">
              <a href={whatsappUrl()} target="_blank" rel="noopener" className="guia-duda">
                ¿Te quedó una duda? Escribinos por WhatsApp
              </a>
              <div className="guia-nav">
                {anterior && (
                  <button type="button" className="btn btn-ghost" onClick={() => setAbierta(anterior.id)}>
                    <ArrowLeft /> {anterior.corto}
                  </button>
                )}
                {siguiente ? (
                  <button type="button" className="btn btn-pri" onClick={() => setAbierta(siguiente.id)}>
                    {siguiente.corto} <ArrowRight />
                  </button>
                ) : (
                  <button type="button" className="btn btn-pri" onClick={() => setAbierta(null)}>
                    Listo
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
