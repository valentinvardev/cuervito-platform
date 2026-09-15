"use client";

import { useEffect, useState } from "react";

/* Lo que de verdad pasa en el servidor, en orden: se baja la foto, se recorta,
   satori maqueta el texto, sharp comprime a JPEG. Los tiempos de abajo no son
   medidos: son para que el renglón cambie cada tanto y se note que algo
   avanza. El último se queda hasta que llega la imagen. */
const PASOS = [
  "Buscando la foto",
  "Recortando el encuadre",
  "Poniendo el título y el logo",
  "Comprimiendo para Instagram",
  "Ya casi está",
];
const CADA_MS = 1900;

/**
 * "Armando tu historia": lo que se ve mientras el servidor renderiza.
 *
 * Tarda entre dos y seis segundos, y un texto quieto durante seis segundos se
 * lee como "se colgó". Por eso hay tres cosas que se mueven: un anillo, un
 * renglón que va diciendo qué se está haciendo, y una barra que avanza y
 * frena cerca del final sin llegar, porque no sabemos cuánto falta y una
 * barra que llega al 100 % y sigue esperando es peor que ninguna.
 *
 * Detrás, un esqueleto de la pieza —el degradado y las barras del título—
 * para que se entienda que lo que se arma es una historia.
 *
 * `sobre` es para cuando ya hay una imagen anterior debajo: el fondo se
 * vuelve translúcido y se ve la anterior atenuada, que es la referencia de lo
 * que se estaba comparando.
 */
export function Armando({
  titulo = "Armando tu historia",
  sobre = false,
}: {
  titulo?: string;
  sobre?: boolean;
}) {
  const [paso, setPaso] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setPaso((p) => Math.min(p + 1, PASOS.length - 1)), CADA_MS);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="armando" data-sobre={sobre ? "1" : undefined} role="status" aria-live="polite">
      {!sobre && (
        <div className="armando-esq" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </div>
      )}
      <div className="armando-c">
        <div className="armando-anillo" aria-hidden="true" />
        <div className="armando-t">{titulo}</div>
        <div className="armando-s" key={paso}>
          {PASOS[paso]}…
        </div>
        <div className="armando-barra" aria-hidden="true">
          <i />
        </div>
      </div>
    </div>
  );
}
