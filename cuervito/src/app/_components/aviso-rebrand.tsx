"use client";

import { useEffect, useState } from "react";

/**
 * Aviso general del rebrand a encontrate.app.
 *
 * La clave lleva el nombre del aviso y no un genérico tipo "aviso-visto":
 * cuando venga el próximo anuncio se cambia la clave y vuelve a aparecer para
 * todos, sin tener que pedirle a nadie que limpie el navegador.
 */
const CLAVE = "cuervito.aviso.rebrand-encontrate";

export function AvisoRebrand() {
  // Arranca oculto y aparece después de montar. En el servidor no hay forma de
  // saber si este visitante ya lo cerró, así que pintarlo de entrada haría que
  // a los que lo descartaron les parpadee antes de desaparecer. La animación
  // de bajada tapa ese cuadro de diferencia y el movimiento se lee intencional.
  const [visible, setVisible] = useState(false);
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(CLAVE) === "1") return;
    } catch {
      // Navegador con almacenamiento bloqueado: se muestra igual.
    }
    setVisible(true);
  }, []);

  function cerrar() {
    setVisible(false);
    try {
      localStorage.setItem(CLAVE, "1");
    } catch {
      // noop
    }
  }

  if (!visible) return null;

  return (
    <aside className="aviso" role="region" aria-label="Aviso general">
      <div className="aviso-in">
        <span className="aviso-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
               strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 11v2a1 1 0 0 0 1 1h2l3.5 3.5a1 1 0 0 0 1.7-.7V7.2a1 1 0 0 0-1.7-.7L6 10H4a1 1 0 0 0-1 1Z" />
            <path d="M16 9a3 3 0 0 1 0 6" />
            <path d="M19.5 6.5a7 7 0 0 1 0 11" />
          </svg>
        </span>

        <div className="aviso-txt">
          <p className="aviso-head">
            <b>cuervito.app pasa a llamarse encontrate.app.</b>{" "}
            No cambia nada para vos: tus eventos y los links viejos van a seguir
            funcionando igual.
          </p>

          {/* 0fr a 1fr: la altura se anima sin tener que medirla con JS ni
              forzar reflows, y funciona con cualquier largo de texto. */}
          <div className="aviso-mas" data-abierto={abierto ? "1" : ""}>
            <div className="aviso-mas-in">
              <p>Buenas noches comunidad de cuervito.app</p>
              <p>
                Les quiero avisar que vamos a cambiar la marca a encontrate.app,
                esto para mejorar la presencia de la plataforma y una oportunidad
                de mejorarla visualmente.
              </p>
              <p>
                Nadie va a sufrir ningún cambio, los eventos van a seguir igual,
                los links viejos van a enviar a los nuevos, incluso los links de
                eventos, así que el cambio no va a causar ninguna cosa negativa.
              </p>
              <p>
                La idea es volvernos la mejor plataforma de venta de fotografías,
                y vamos a agregar funcionalidades únicas en estas semanas.
              </p>
              <p>¡Muchas gracias por confiar!</p>
            </div>
          </div>

          <button
            type="button"
            className="aviso-toggle"
            aria-expanded={abierto}
            onClick={() => setAbierto((v) => !v)}
          >
            {abierto ? "Ocultar" : "Leer el aviso completo"}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
                 strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
        </div>

        <button type="button" className="aviso-x" onClick={cerrar} aria-label="Cerrar aviso">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
               strokeLinecap="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </aside>
  );
}
