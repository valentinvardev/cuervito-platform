"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

export type Pestana = { id: string; texto: string; icono: React.ReactNode; aviso?: number };

/**
 * Las pestañas del portfolio, con su contenido.
 *
 * Los cuatro paneles llegan ya armados del servidor y el cambio es un estado
 * del navegador: instantáneo, sin esperar una página nueva. La dirección se
 * actualiza igual (?pestana=) para que recargar o compartir el link abra la
 * misma pestaña, y los links siguen siendo links: con la rueda o Ctrl se
 * abren en otra pestaña del navegador.
 *
 * El subrayado es un solo elemento que se desliza hasta la elegida, y el
 * contenido entra con una animación corta (key por pestaña).
 */
export function Pestanas({
  items,
  activa,
  base,
  paneles,
}: {
  items: Pestana[];
  activa: string;
  base: string;
  paneles: Record<string, React.ReactNode>;
}) {
  const [actual, setActual] = useState(activa);
  useEffect(() => setActual(activa), [activa]);

  const nav = useRef<HTMLElement>(null);
  const [marca, setMarca] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const n = nav.current;
    if (!n) return;
    const medir = () => {
      const a = n.querySelector<HTMLElement>(`[data-id="${actual}"]`);
      if (a) setMarca({ left: a.offsetLeft, width: a.offsetWidth });
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(n);
    return () => ro.disconnect();
  }, [actual]);

  const hrefDe = (id: string) => (id === items[0]?.id ? base : `${base}?pestana=${id}`);

  function elegir(e: React.MouseEvent, id: string) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    setActual(id);
    window.history.replaceState(null, "", hrefDe(id));
  }

  return (
    <>
      <nav ref={nav} className="pf-pestanas" aria-label="Secciones del portfolio">
        {items.map((t) => (
          <Link
            key={t.id}
            data-id={t.id}
            href={hrefDe(t.id)}
            aria-current={actual === t.id ? "page" : undefined}
            scroll={false}
            onClick={(e) => elegir(e, t.id)}
          >
            {t.icono}
            {t.texto}
            {t.aviso ? <b>{t.aviso}</b> : null}
          </Link>
        ))}
        {marca && <span className="pf-pestanas-ind" style={{ left: marca.left, width: marca.width }} aria-hidden="true" />}
      </nav>
      <div key={actual} className="pf-pestana-cuerpo">
        {paneles[actual]}
      </div>
    </>
  );
}
