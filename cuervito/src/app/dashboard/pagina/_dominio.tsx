"use client";

import { Globe, X } from "lucide-react";
import { useEffect, useState } from "react";

import { whatsappUrl } from "~/lib/support";

import { GlifoWhatsapp } from "../_components/glifo-whatsapp";

/**
 * Conectar un dominio propio.
 *
 * No es un formulario: conectar un dominio pide cargar registros donde el
 * fotógrafo lo compró, y en cada proveedor la pantalla es distinta. Por
 * escrito, ese paso es donde la gente se traba y abandona; con alguien del
 * otro lado que le dice qué tocar, se resuelve en una charla. Así que el botón
 * explica qué va a pasar y lo manda a WhatsApp con el mensaje ya escrito,
 * para que la conversación arranque sabiendo de qué página se trata.
 */
export function Dominio({ slug }: { slug: string }) {
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    document.documentElement.dataset.modal = "open";
    const alTecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
    };
    window.addEventListener("keydown", alTecla);
    return () => {
      window.removeEventListener("keydown", alTecla);
      document.documentElement.dataset.modal = "";
    };
  }, [abierto]);

  const mensaje = `Hola! Quiero conectar mi dominio a mi página de encontrate (encontrate.app/${slug}).`;

  return (
    <>
      {/* type="button" en todos: este bloque vive dentro del formulario de la
          dirección, y un botón sin tipo lo mandaría. */}
      <div className="propio">
        <span>¿Tenés un dominio propio?</span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAbierto(true)}>
          <Globe /> Conectar tu dominio
        </button>
      </div>

      {abierto && (
        <div
          className="modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dominio-titulo"
          onClick={(e) => {
            if (e.target === e.currentTarget) setAbierto(false);
          }}
        >
          <div className="modal-caja">
            <div className="modal-h">
              <div>
                <h2 id="dominio-titulo">Conectar tu dominio</h2>
                <div className="sub">Tu página en tu propia dirección, como fotosdejuan.com.ar.</div>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                onClick={() => setAbierto(false)}
                aria-label="Cerrar"
              >
                <X />
              </button>
            </div>

            <div className="modal-b">
              <p className="dmn-txt">
                Lo conectamos con vos por WhatsApp, sin costo extra.
              </p>
              <ol className="dmn-pasos">
                <li>Nos escribís con el dominio que querés usar.</li>
                <li>
                  Te decimos qué cargar donde lo compraste (NIC Argentina, GoDaddy, Hostinger, el
                  que sea) y te acompañamos mientras lo hacés.
                </li>
                <li>Te avisamos cuando tu página ya se ve en tu dominio.</li>
              </ol>
              <div className="porque">
                <Globe />
                <span>
                  ¿Todavía no tenés dominio? Escribinos igual y te ayudamos a elegir uno.
                </span>
              </div>
            </div>

            <div className="modal-f">
              <button type="button" className="btn btn-ghost" onClick={() => setAbierto(false)}>
                Cancelar
              </button>
              <a
                href={whatsappUrl(mensaje)}
                target="_blank"
                rel="noopener"
                className="btn btn-wa-sol"
                onClick={() => setAbierto(false)}
              >
                <GlifoWhatsapp /> Escribir por WhatsApp
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
