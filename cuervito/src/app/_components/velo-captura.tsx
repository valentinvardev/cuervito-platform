"use client";

import { useEffect } from "react";

/** Las teclas con las que empieza casi toda captura de pantalla. */
const TECLAS = new Set(["Control", "Meta", "PrintScreen"]);

/**
 * El velo contra la captura de pantalla.
 *
 * Mientras está apretada Ctrl, Cmd o Impr Pant, y mientras la pestaña no
 * tiene el foco, <html> lleva data-velo y la hoja de la tienda desenfoca las
 * fotos en venta. No impide la captura: la deja sin foto en el momento en
 * que más se hace, con la foto abierta en grande y la mano en el atajo.
 *
 * El foco cuenta porque la herramienta de recorte de Windows o la de Mac se
 * llevan el foco al abrirse, y la tecla que las abre (Win, Cmd) a veces no
 * manda el keyup cuando el sistema se la queda. Por eso el velo se saca al
 * volver el foco, no sólo al soltar la tecla.
 *
 * Es un atributo y no estado de React: lo leen la grilla, el visor y el
 * carrito, que viven en árboles distintos, y la hoja decide qué desenfocar.
 * El aviso de abajo dice por qué se nubló todo: sin él, Ctrl+F parece un
 * bug de la página.
 */
export function VeloCaptura() {
  useEffect(() => {
    const raiz = document.documentElement;
    const poner = () => {
      raiz.dataset.velo = "1";
    };
    const sacar = () => {
      delete raiz.dataset.velo;
    };
    const alApretar = (e: KeyboardEvent) => {
      if (TECLAS.has(e.key) || e.ctrlKey || e.metaKey) poner();
    };
    const alSoltar = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) sacar();
    };
    const alVisibilidad = () => (document.hidden ? poner() : sacar());

    window.addEventListener("keydown", alApretar);
    window.addEventListener("keyup", alSoltar);
    window.addEventListener("blur", poner);
    window.addEventListener("focus", sacar);
    document.addEventListener("visibilitychange", alVisibilidad);
    return () => {
      window.removeEventListener("keydown", alApretar);
      window.removeEventListener("keyup", alSoltar);
      window.removeEventListener("blur", poner);
      window.removeEventListener("focus", sacar);
      document.removeEventListener("visibilitychange", alVisibilidad);
      sacar();
    };
  }, []);

  return (
    <div className="velo-aviso" aria-live="polite">
      Las fotos se ocultan mientras apretás Ctrl
    </div>
  );
}
