"use client";

import { Moon, Sun } from "lucide-react";

/**
 * El interruptor de claro/oscuro del diseño de encontrate.
 *
 * Vive acá, fuera de cualquier ruta, porque lo usan la landing y las cuatro
 * pantallas de autenticación. Cuando estaba duplicado, la política de qué se
 * escribe en data-theme estaba escrita dos veces, y ese valor lo lee también el
 * interruptor del panel viejo: alcanzaba con que una de las dos copias
 * escribiera "" en vez de "light" para que el otro panel se convenciera de
 * estar en oscuro estando en claro.
 *
 * `js-tema` no es un gancho de JavaScript —el click va por props— pero la clase
 * NO se puede sacar: el CSS de la landing la usa como excepción
 * (`.solo-ancho:not(.js-tema)`) para que entre 700 y 920px se escondan las
 * cosas de pantalla ancha menos este botón.
 */
export function BotonTema({ className = "" }: { className?: string }) {
  /**
   * data-theme vale "light" o "dark", nunca otra cosa.
   *
   * Es la misma política que el script del layout raíz, que ya resolvió el tema
   * antes de pintar.
   */
  function cambiar() {
    const raiz = document.documentElement;
    const proximo = raiz.dataset.theme === "dark" ? "light" : "dark";
    raiz.dataset.theme = proximo;
    try {
      localStorage.setItem("cuervito-theme", proximo);
    } catch {
      // almacenamiento bloqueado: el tema dura lo que dure la pestaña
    }
  }

  return (
    <button
      type="button"
      className={`btn btn-ghost btn-icon js-tema ${className}`.trim()}
      onClick={cambiar}
      aria-label="Cambiar tema"
    >
      <span className="ico ico-moon">
        <Moon />
      </span>
      <span className="ico ico-sun">
        <Sun />
      </span>
    </button>
  );
}
