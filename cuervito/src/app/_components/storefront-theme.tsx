"use client";

import { useEffect } from "react";

/**
 * Fija el tema oscuro mientras se está en el storefront y lo restaura al
 * salir.
 *
 * El storefront es la página de marca del fotógrafo y tiene que verse
 * igual para todos los compradores, sin depender del tema que tenga
 * guardado el visitante.
 *
 * Se hace sobre el atributo data-theme y no con CSS a propósito. El
 * intento anterior re-declaraba los tokens oscuros con un selector de
 * alta especificidad dentro de public-event.css, y eso se filtraba: en
 * una navegación SPA (por ejemplo el checkout, que hace router.push a
 * /descarga) la hoja sigue cargada y seguía pisando los tokens claros
 * fuera del storefront. Cambiando el atributo, el CSS normal hace lo
 * correcto en cada página sin reglas especiales.
 */
export function StorefrontTheme() {
  useEffect(() => {
    const el = document.documentElement;
    el.dataset.theme = "dark";
    return () => {
      // Al salir volvemos a la preferencia real del visitante, con la
      // misma lógica que el script de arranque en el layout raíz.
      let next: string;
      try {
        const saved = localStorage.getItem("cuervito-theme");
        if (saved === "light" || saved === "dark") {
          next = saved;
        } else {
          const h = new Date().getHours();
          next = h >= 7 && h < 19 ? "light" : "dark";
        }
      } catch {
        next = "dark";
      }
      el.dataset.theme = next;
    };
  }, []);

  return null;
}
