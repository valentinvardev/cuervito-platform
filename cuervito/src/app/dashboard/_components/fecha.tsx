"use client";

import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

// La semana arranca el lunes, como en Argentina. getDay() da 0 para domingo,
// así que hay que correr el índice en todos lados donde se use.
const DIAS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];

/**
 * Una fecha en formato aaaa-mm-dd, sin pasar por Date.
 *
 * `new Date("2026-08-14")` se interpreta como medianoche UTC, que en Argentina
 * es el 13 a las 21:00. Formatear eso con la zona local devuelve el día
 * anterior, y así es como un evento del 14 aparece como 13 en la pantalla.
 * Todo lo que entra o sale de acá lleva mediodía para no rozar ningún borde.
 */
function aFecha(iso: string | null): Date | null {
  if (!iso) return null;
  const d = new Date(`${iso}T12:00:00`);
  return isNaN(d.getTime()) ? null : d;
}

function aISO(d: Date) {
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

function mismoDia(a: Date | null, b: Date | null) {
  return (
    !!a &&
    !!b &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** "14 de agosto", y con año sólo si no es este. */
function largo(d: Date) {
  const año = d.getFullYear() !== new Date().getFullYear() ? ` de ${d.getFullYear()}` : "";
  return `${d.getDate()} de ${MESES[d.getMonth()]}${año}`;
}

/**
 * El selector de fecha del panel.
 *
 * Reemplaza al <input type="date"> nativo. El nativo funciona y sabe de
 * teclado, pero se dibuja con los colores del sistema operativo: en una
 * pantalla en tema oscuro aparece un cuadro blanco de Windows, y el mes en
 * inglés si el sistema está en inglés. En un producto donde el resto de los
 * campos son nuestros, es la única cosa que se ve prestada.
 *
 * Lo que había que no perder del nativo y está acá: Escape cierra, Enter y
 * espacio abren, las flechas cambian de mes, hay foco visible y el día elegido
 * se anuncia con aria-selected. Lo que sí se pierde es la escritura directa con
 * el teclado numérico; a cambio, "Hoy" y "Borrar" resuelven los dos casos por
 * los que uno tipearía.
 */
export function Fecha({
  valor,
  alCambiar,
  vacio = "Elegí la fecha",
  id,
}: {
  valor: string | null;
  alCambiar: (iso: string | null) => void;
  vacio?: string;
  id?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);

  const elegido = aFecha(valor);
  const hoy = new Date();

  // El mes que se está mirando, que no es lo mismo que el elegido: se puede
  // pasear por el calendario sin elegir nada.
  const [vista, setVista] = useState(() => {
    const v = new Date(elegido ?? hoy);
    v.setDate(1);
    return v;
  });

  // Al abrir vuelve al mes de la fecha elegida. Si no, quien mira marzo, cierra
  // y vuelve a abrir se encuentra en marzo sin saber por qué.
  useEffect(() => {
    if (!abierto) return;
    const v = new Date(aFecha(valor) ?? new Date());
    v.setDate(1);
    setVista(v);
  }, [abierto, valor]);

  // Click afuera y Escape cierran. Sin lo primero quedan dos calendarios
  // abiertos a la vez en cuanto hay más de una fecha en la pantalla.
  useEffect(() => {
    if (!abierto) return;
    const alClick = (e: MouseEvent) => {
      if (!caja.current?.contains(e.target as Node)) setAbierto(false);
    };
    const alTecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
    };
    document.addEventListener("mousedown", alClick);
    document.addEventListener("keydown", alTecla);
    return () => {
      document.removeEventListener("mousedown", alClick);
      document.removeEventListener("keydown", alTecla);
    };
  }, [abierto]);

  function moverMes(n: number) {
    setVista((v) => {
      const x = new Date(v);
      x.setMonth(x.getMonth() + n);
      return x;
    });
  }

  // Seis semanas siempre. Con las justas, el calendario cambia de alto al pasar
  // de mes y los botones de abajo se mueven bajo el dedo.
  const primero = new Date(vista.getFullYear(), vista.getMonth(), 1);
  const corr = (primero.getDay() + 6) % 7;
  const inicio = new Date(primero);
  inicio.setDate(1 - corr);
  const celdas = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(inicio);
    d.setDate(inicio.getDate() + i);
    return d;
  });

  return (
    <div className="fx" ref={caja} data-abierto={abierto ? "1" : ""} data-hay={valor ? "1" : ""}>
      <button
        type="button"
        className="fx-t"
        id={id}
        aria-expanded={abierto}
        aria-haspopup="dialog"
        onClick={() => setAbierto((v) => !v)}
      >
        <CalendarDays />
        <span className={`fx-v ${elegido ? "" : "vacio"}`}>{elegido ? largo(elegido) : vacio}</span>
        {valor && (
          // Un <span> y no un <button>: adentro de otro botón, un botón anidado
          // es HTML inválido y el navegador lo saca del medio al parsear.
          <span
            className="fx-borrar"
            role="button"
            tabIndex={0}
            aria-label="Borrar la fecha"
            onClick={(e) => {
              e.stopPropagation();
              alCambiar(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                alCambiar(null);
              }
            }}
          >
            <X />
          </span>
        )}
      </button>

      <div className="fx-m" role="dialog" aria-label="Elegí una fecha">
        <div className="fx-nav">
          <button type="button" onClick={() => moverMes(-1)} aria-label="Mes anterior">
            <ChevronLeft />
          </button>
          <b>
            {MESES[vista.getMonth()]} {vista.getFullYear()}
          </b>
          <button type="button" onClick={() => moverMes(1)} aria-label="Mes siguiente">
            <ChevronRight />
          </button>
        </div>

        <div className="fx-sem">
          {DIAS.map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>

        {/* Una lista de opciones y no botones sueltos: el CSS marca el día
            elegido con [aria-selected], y ese atributo sólo tiene sentido
            dentro de algo que se elige. Suelto en un <button> no significa nada
            para un lector de pantalla. */}
        <div className="fx-grid" role="listbox" aria-label="Días del mes">
          {celdas.map((d) => {
            const fuera = d.getMonth() !== vista.getMonth();
            return (
              <button
                type="button"
                role="option"
                key={d.toISOString()}
                className={`fx-d${fuera ? " fuera" : ""}${mismoDia(d, hoy) ? " hoy" : ""}`}
                aria-selected={mismoDia(d, elegido)}
                aria-label={largo(d)}
                onClick={() => {
                  alCambiar(aISO(d));
                  setAbierto(false);
                }}
              >
                {d.getDate()}
              </button>
            );
          })}
        </div>

        <div className="fx-pie">
          <button
            type="button"
            onClick={() => {
              alCambiar(aISO(new Date()));
              setAbierto(false);
            }}
          >
            Hoy
          </button>
          <button
            type="button"
            onClick={() => {
              alCambiar(null);
              setAbierto(false);
            }}
          >
            Borrar
          </button>
        </div>
      </div>
    </div>
  );
}
