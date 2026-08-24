"use client";

import { useEffect, useRef, useState } from "react";

const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const W = 300;
const H = 100;
const PAD = 6;

/**
 * Gráfico de ventas por día.
 *
 * El SVG se estira con preserveAspectRatio="none" para ocupar el ancho, así que
 * el trazo lleva vector-effect y la línea de cursor y el punto van en HTML por
 * encima: dentro de un sistema de coordenadas deformado, un círculo sale
 * ovalado y un trazo de 1px sale de grosor variable.
 */
export function Grafico({ puntos }: { puntos: { dia: string; monto: number }[] }) {
  const caja = useRef<HTMLDivElement>(null);
  const [activo, setActivo] = useState<number | null>(null);

  /* Cuando entra una venta el panel se refresca y la curva cambia sola. Sin
     nada más, cambia de un cuadro al otro y no se ve: el trazo de un día entre
     treinta se mueve unos pocos píxeles. Así que se vuelve a dibujar de
     izquierda a derecha, que es lo que hace notar que hay dato nuevo.

     La firma se calcula ACÁ ARRIBA y no con la ruta del path, porque más abajo
     hay un return temprano —cuando no alcanzan los puntos— y un hook después
     de un return condicional es un hook que a veces no corre. */
  const firma = puntos.map((x) => x.monto).join(",");
  const [redibujo, setRedibujo] = useState(0);
  const firmaAnterior = useRef<string | null>(null);
  useEffect(() => {
    if (firmaAnterior.current !== null && firmaAnterior.current !== firma) {
      setRedibujo((k) => k + 1);
    }
    firmaAnterior.current = firma;
  }, [firma]);

  if (puntos.length < 2) {
    return (
      <div className="empty" style={{ padding: "var(--s-7) var(--s-4)" }}>
        <p>Todavía no hay ventas suficientes para dibujar la curva.</p>
      </div>
    );
  }

  const montos = puntos.map((p) => p.monto);
  const max = Math.max(...montos);
  const min = Math.min(...montos);
  const rango = max - min || 1;

  const coords = puntos.map((p, i) => ({
    x: PAD + (i / (puntos.length - 1)) * (W - PAD * 2),
    y: H - PAD - ((p.monto - min) / rango) * (H - PAD * 2),
    ...p,
  }));

  const d = coords.map((c, i) => `${i ? "L" : "M"}${c.x.toFixed(2)} ${c.y.toFixed(2)}`).join(" ");
  const area = `${d} L${W - PAD} ${H} L${PAD} ${H} Z`;

  function mover(e: React.MouseEvent) {
    const r = caja.current?.getBoundingClientRect();
    if (!r) return;
    // El puntero se convierte a índice con el ancho REAL de la caja, no con el
    // del viewBox: el SVG se estira y los dos sistemas no coinciden.
    const i = Math.round(((e.clientX - r.left) / r.width) * (coords.length - 1));
    setActivo(Math.max(0, Math.min(coords.length - 1, i)));
  }

  const p = activo !== null ? coords[activo] : null;
  const r = caja.current?.getBoundingClientRect();
  const px = p && r ? (p.x / W) * r.width : 0;
  const py = p && r ? (p.y / H) * r.height : 0;
  const f = p ? new Date(p.dia + "T12:00:00") : null;

  return (
    <>
      <div
        className={`chart${p ? " on" : ""}`}
        ref={caja}
        onMouseMove={mover}
        onMouseLeave={() => setActivo(null)}
      >
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="v2fade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--ink)" stopOpacity=".13" />
              <stop offset="100%" stopColor="var(--ink)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <g className="grid">
            {[0, 1, 2, 3].map((g) => {
              const y = PAD + (g / 3) * (H - PAD * 2);
              return <line key={g} x1={0} x2={W} y1={y} y2={y} />;
            })}
          </g>
          <path className="ar" d={area} fill="url(#v2fade)" />
          <path
            key={redibujo}
            className={redibujo ? "ln redibuja" : "ln"}
            // Normaliza el largo a 1 para que el guion del trazo no dependa de
            // la escala: el SVG se estira con preserveAspectRatio="none" y en
            // unidades del viewBox el largo real no es el que se ve.
            pathLength={1}
            d={d}
          />
        </svg>

        <div className="cur" style={{ left: px }} />
        <div className="pt" style={{ left: px, top: py }} />
        <div className="tip" style={{ left: Math.max(54, Math.min((r?.width ?? 0) - 54, px)), top: py }}>
          {p && f && (
            <>
              <b>${p.monto.toLocaleString("es-AR")}</b>
              <span>
                {f.getDate()} de {MES[f.getMonth()]}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="x-ax">
        {[0, Math.floor(coords.length / 2), coords.length - 1].map((i) => {
          const fecha = new Date(coords[i]!.dia + "T12:00:00");
          return (
            <span key={i}>
              {fecha.getDate()} {MES[fecha.getMonth()]}
            </span>
          );
        })}
      </div>
    </>
  );
}
