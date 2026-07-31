"use client";

import { useEffect } from "react";

/**
 * Marca cada `.reveal` con data-revealed cuando entra al viewport.
 *
 * Usa un atributo y no una clase a propósito: varios `.reveal` tienen el
 * className manejado por React (por ejemplo la grilla de eventos, que le
 * saca la clase de skeleton al cargar). Si marcáramos con classList.add,
 * el siguiente render de React reescribiría className y borraría la
 * marca, devolviendo el elemento a opacity:0 — se veía como un fade out
 * al scrollear o al tipear en el buscador. React no toca los atributos
 * que no declara, así que esto sobrevive a cualquier re-render.
 */
export function RevealOnScroll() {
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.setAttribute("data-revealed", "");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 },
    );

    const targets = document.querySelectorAll<HTMLElement>(".reveal");
    targets.forEach((el) => io.observe(el));

    return () => io.disconnect();
  }, []);

  return null;
}
