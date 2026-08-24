"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Cifra que sube al entrar en pantalla, y que vuelve a subir cuando cambia.
 *
 * El valor final se pinta en el primer render, así que si el JS no corre o el
 * usuario pidió menos movimiento, el número está igual. La animación sólo lo
 * reemplaza durante un segundo, nunca lo produce.
 *
 * Dos animaciones distintas, con reglas distintas:
 *
 * · La de ENTRADA va de cero al valor y espera a que la cifra se vea. Animar
 *   algo fuera de pantalla es gastar la animación.
 *
 * · La de CAMBIO va del valor anterior al nuevo y arranca al toque, sin
 *   esperar a nada. Pasa cuando entra una venta y el panel se refresca solo:
 *   si arrancara de cero, un total de dos millones se desplomaría a cero y
 *   volvería a subir, que se lee como un error y no como una venta. Y si
 *   esperara a estar en pantalla, el fotógrafo que está mirando otra tarjeta
 *   volvería a ésta y encontraría el número ya cambiado, sin haber visto nada.
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
  /** Desde dónde tiene que salir la próxima animación. */
  const anterior = useRef(valor);
  /** El cuadro pedido, para cancelarlo si llega otro cambio encima. */
  const cuadro = useRef<number | null>(null);

  useEffect(() => {
    const el = nodo.current;
    if (!el) return;

    const quieto = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (quieto) {
      anterior.current = valor;
      setTexto(formato(valor));
      return;
    }

    const animar = (desde: number, dur: number, esperar: number) => {
      if (cuadro.current !== null) cancelAnimationFrame(cuadro.current);
      let t0: number | null = null;

      const paso = (t: number) => {
        t0 ??= t;
        let p = (t - t0 - esperar) / dur;
        if (p < 0) {
          cuadro.current = requestAnimationFrame(paso);
          return;
        }
        p = Math.min(1, p);
        const e = 1 - Math.pow(1 - p, 3); // ease-out: arranca rápido y frena
        setTexto(formato(desde + (valor - desde) * e));
        if (p < 1) cuadro.current = requestAnimationFrame(paso);
        else {
          cuadro.current = null;
          setTexto(formato(valor));
        }
      };

      setTexto(formato(desde));
      cuadro.current = requestAnimationFrame(paso);
    };

    // Un cambio de valor con la entrada ya hecha: del anterior al nuevo, ya.
    // Más corto que la entrada, porque el salto es chico y mil milisegundos
    // para sumar cuatro fotos se siente lento.
    if (corrio.current) {
      const desde = anterior.current;
      anterior.current = valor;
      if (desde !== valor) animar(desde, 620, 0);
      return;
    }

    const obs = new IntersectionObserver(
      (ent) => {
        if (!ent[0]?.isIntersecting) return;
        obs.disconnect();
        corrio.current = true;
        anterior.current = valor;
        animar(0, 1000, retardo);
      },
      { threshold: 0.4 },
    );
    obs.observe(el);

    return () => {
      obs.disconnect();
      if (cuadro.current !== null) cancelAnimationFrame(cuadro.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor]);

  return <span ref={nodo}>{texto}</span>;
}
