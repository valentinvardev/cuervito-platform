"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

export type Pestana = { id: string; texto: string; icono: React.ReactNode; aviso?: number };

/**
 * Las pestañas del portfolio. Son links (cada pestaña es la misma página con
 * ?pestana=) y el subrayado es un solo elemento que se desliza hasta la
 * elegida, en vez de un borde en cada una: así el cambio se ve como un
 * movimiento y no como un parpadeo.
 *
 * La elegida se marca al hacer click, antes de que el servidor conteste, para
 * que el subrayado no espere a la red; cuando llega la página nueva, `activa`
 * confirma.
 */
export function Pestanas({ items, activa, base }: { items: Pestana[]; activa: string; base: string }) {
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

  return (
    <nav ref={nav} className="pf-pestanas" aria-label="Secciones del portfolio">
      {items.map((t, i) => (
        <Link
          key={t.id}
          data-id={t.id}
          href={i === 0 ? base : `${base}?pestana=${t.id}`}
          aria-current={actual === t.id ? "page" : undefined}
          scroll={false}
          onClick={() => setActual(t.id)}
        >
          {t.icono}
          {t.texto}
          {t.aviso ? <b>{t.aviso}</b> : null}
        </Link>
      ))}
      {marca && <span className="pf-pestanas-ind" style={{ left: marca.left, width: marca.width }} aria-hidden="true" />}
    </nav>
  );
}
