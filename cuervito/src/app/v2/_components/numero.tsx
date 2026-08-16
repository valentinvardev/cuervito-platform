"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Cifra que sube al entrar en pantalla.
 *
 * El valor final se pinta en el primer render, así que si el JS no corre o el
 * usuario pidió menos movimiento, el número está igual. La animación sólo lo
 * reemplaza durante un segundo, nunca lo produce.
 *
 * El origen del tiempo sale del PRIMER cuadro y no de performance.now(): son
 * dos relojes distintos y, si la pestaña pasa a segundo plano,
 * requestAnimationFrame se detiene mientras el otro sigue, así que al volver el
 * número aparecería ya terminado en vez de animarse.
 */
export function Numero({
  valor,
  decimales = 0,
  prefijo = "",
  retardo = 0,
}: {
  valor: number;
  decimales?: number;
  prefijo?: string;
  retardo?: number;
}) {
  const formato = (v: number) =>
    prefijo +
    v.toLocaleString("es-AR", {
      minimumFractionDigits: decimales,
      maximumFractionDigits: decimales,
    });

  const [texto, setTexto] = useState(() => formato(valor));
  const nodo = useRef<HTMLSpanElement>(null);
  const corrio = useRef(false);

  useEffect(() => {
    const el = nodo.current;
    if (!el || corrio.current) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const arrancar = () => {
      if (corrio.current) return;
      corrio.current = true;
      let t0: number | null = null;
      const dur = 1000;

      const paso = (t: number) => {
        t0 ??= t;
        let p = (t - t0 - retardo) / dur;
        if (p < 0) {
          requestAnimationFrame(paso);
          return;
        }
        p = Math.min(1, p);
        const e = 1 - Math.pow(1 - p, 3); // ease-out: arranca rápido y frena
        setTexto(formato(valor * e));
        if (p < 1) requestAnimationFrame(paso);
        else setTexto(formato(valor));
      };

      setTexto(formato(0));
      requestAnimationFrame(paso);
    };

    // Sólo cuando se ve: animar algo fuera de pantalla gasta la animación.
    const obs = new IntersectionObserver(
      (ent) => {
        if (ent[0]?.isIntersecting) {
          arrancar();
          obs.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    obs.observe(el);
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor]);

  return <span ref={nodo}>{texto}</span>;
}
