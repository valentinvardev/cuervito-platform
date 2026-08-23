"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type Opcion = { valor: string; texto: string };

/**
 * El desplegable del panel, en vez del <select> nativo.
 *
 * El nativo funciona, pero lo dibuja el sistema operativo: en tema oscuro se
 * abre una lista blanca de Windows con su propia tipografía, y en un formulario
 * donde todo lo demás es nuestro es lo único que se ve prestado. Con dos campos
 * al lado que sí son nuestros, la diferencia se nota.
 *
 * Lo que había que conservar del nativo y está acá: se abre con Enter o espacio,
 * se recorre con las flechas, Inicio y Fin van a los extremos, Escape cierra
 * volviendo al valor anterior, y la opción activa se anuncia con aria-selected.
 * Lo que se pierde es escribir la primera letra para saltar; con listas de siete
 * opciones no compensa el código que hace falta para eso.
 */
export function Desplegable({
  opciones,
  valor,
  alCambiar,
  vacio = "Sin especificar",
  id,
  permiteVacio = true,
}: {
  opciones: Opcion[];
  valor: string;
  alCambiar: (valor: string) => void;
  vacio?: string;
  id?: string;
  permiteVacio?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [marcado, setMarcado] = useState(0);
  const caja = useRef<HTMLDivElement>(null);
  const lista = useRef<HTMLDivElement>(null);

  const todas: Opcion[] = permiteVacio ? [{ valor: "", texto: vacio }, ...opciones] : opciones;
  const actual = todas.find((o) => o.valor === valor);

  useEffect(() => {
    if (!abierto) return;
    setMarcado(Math.max(0, todas.findIndex((o) => o.valor === valor)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  // Click afuera y Escape cierran. Sin lo primero quedan dos abiertos a la vez
  // en cuanto hay más de un desplegable en la pantalla.
  useEffect(() => {
    if (!abierto) return;
    const alClick = (e: MouseEvent) => {
      if (!caja.current?.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("mousedown", alClick);
    return () => document.removeEventListener("mousedown", alClick);
  }, [abierto]);

  // La opción marcada tiene que quedar a la vista: con la lista con scroll, ir
  // con las flechas hasta el final movía la marca fuera de la ventana.
  useEffect(() => {
    if (!abierto) return;
    lista.current?.children[marcado]?.scrollIntoView({ block: "nearest" });
  }, [marcado, abierto]);

  function alTecla(e: React.KeyboardEvent) {
    if (!abierto) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setAbierto(true);
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setAbierto(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setMarcado((i) => Math.min(i + 1, todas.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setMarcado((i) => Math.max(i - 1, 0));
    } else if (e.key === "Home") {
      e.preventDefault();
      setMarcado(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setMarcado(todas.length - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const o = todas[marcado];
      if (o) alCambiar(o.valor);
      setAbierto(false);
    }
  }

  return (
    <div className="dd campo-dd" ref={caja} data-abierto={abierto ? "1" : ""}>
      <button
        type="button"
        className="dd-t"
        id={id}
        aria-expanded={abierto}
        aria-haspopup="listbox"
        onClick={() => setAbierto((v) => !v)}
        onKeyDown={alTecla}
      >
        <span className={`dd-v ${actual?.valor ? "" : "vacio"}`}>{actual?.texto ?? vacio}</span>
        <ChevronDown />
      </button>

      <div className="dd-m" role="listbox" ref={lista}>
        {todas.map((o, i) => (
          <button
            type="button"
            key={o.valor || "_vacio"}
            className={`dd-o ${i === marcado && abierto ? "marcado" : ""}`}
            role="option"
            aria-selected={o.valor === valor}
            onMouseEnter={() => setMarcado(i)}
            onClick={() => {
              alCambiar(o.valor);
              setAbierto(false);
            }}
          >
            {o.texto}
          </button>
        ))}
      </div>
    </div>
  );
}
