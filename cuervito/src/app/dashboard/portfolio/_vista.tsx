"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Una página a su ancho real (1280px) achicada para que entre en una caja.
 *
 * Se muestra la página de verdad en un iframe y no una captura: lo que se ve
 * es exactamente lo que va a ver un visitante, con sus fotos y su plantilla, y
 * no hay que mantener imágenes de muestra. Se carga recién cuando la caja
 * entra en pantalla, porque cada una es una página entera.
 */
export function VistaEscalada({
  src,
  ancho,
  alto,
  className,
  estilo,
  titulo,
}: {
  src: string;
  ancho: number;
  alto: number;
  className?: string;
  estilo?: React.CSSProperties;
  titulo: string;
}) {
  const caja = useRef<HTMLDivElement>(null);
  const [escala, setEscala] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const medir = () => setEscala(el.clientWidth / ancho);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    const io = new IntersectionObserver(([e]) => {
      if (e?.isIntersecting) {
        setVisible(true);
        io.disconnect();
      }
    }, { rootMargin: "200px" });
    io.observe(el);
    return () => {
      ro.disconnect();
      io.disconnect();
    };
  }, [ancho]);

  return (
    <div ref={caja} className={className} style={{ position: "relative", overflow: "hidden", ...estilo }}>
      {visible && escala > 0 && (
        <iframe
          src={src}
          title={titulo}
          loading="lazy"
          tabIndex={-1}
          aria-hidden
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: ancho,
            height: alto,
            border: 0,
            transform: `scale(${escala})`,
            transformOrigin: "0 0",
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
}
