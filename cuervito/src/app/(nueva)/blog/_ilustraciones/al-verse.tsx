"use client";

import { RotateCcw } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";

/**
 * Arranca la animación de una ilustración cuando entra en pantalla.
 *
 * El HTML del servidor llega en el estado FINAL —todas las piezas en su
 * lugar—. Recién cuando hay JavaScript y la ilustración todavía no se vio, se
 * pasa a «espera» (el estado inicial) y, al verse, a «juega». Así, el que lee
 * sin JavaScript, un buscador o un agente ven el resultado, nunca una caja
 * vacía esperando una animación que no va a llegar.
 *
 * Con «reducir movimiento» activado no se toca nada: queda el estado final.
 *
 * Las animaciones son CSS y cuelgan de [data-ilus="juega"]; acá sólo se
 * cambia el atributo.
 */
export function AlVerse({
  children,
  className,
  etiqueta,
  repetible = false,
}: {
  children: ReactNode;
  className?: string;
  /** Lo que dice la ilustración, para quien no la ve. */
  etiqueta: string;
  repetible?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [estado, setEstado] = useState<"final" | "espera" | "juega">("final");
  const [vuelta, setVuelta] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!("IntersectionObserver" in window)) return;

    setEstado("espera");
    const obs = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) {
          setEstado("juega");
          obs.disconnect();
        }
      },
      // Un poco adentro: que arranque cuando ya se está mirando, no cuando
      // asoma el borde.
      { rootMargin: "0px 0px -15% 0px", threshold: 0.35 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  function repetir() {
    // Volver a «espera» un cuadro y después a «juega» reinicia las
    // animaciones CSS; la clave cambia para que React no reuse los nodos.
    setEstado("espera");
    setVuelta((v) => v + 1);
    requestAnimationFrame(() => requestAnimationFrame(() => setEstado("juega")));
  }

  return (
    <figure ref={ref} className={`ilus ${className ?? ""}`} data-ilus={estado}>
      <div key={vuelta} className="ilus-escena" aria-hidden="true">
        {children}
      </div>
      {/* La escena es dibujo; lo que dice va en texto, para lectores de
          pantalla y para quien lee el HTML sin mirarlo. */}
      <figcaption className="ilus-sr">{etiqueta}</figcaption>
      {repetible && estado === "juega" && (
        <button type="button" className="ilus-repetir" onClick={repetir}>
          <RotateCcw /> Ver de nuevo
        </button>
      )}
    </figure>
  );
}
