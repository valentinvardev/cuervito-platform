"use client";

import { useEffect } from "react";

import { CLAVE_TEMA_TIENDA } from "~/lib/tema-tienda";

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
 *
 * En la plantilla de encontrate además aplica el claro/oscuro que eligió el
 * visitante (ver lib/tema-tienda), y lo saca al salir: el atributo pinta la
 * página que sigue si nadie lo apaga.
 *
 * Lo mismo con la piel de las plantillas con tema (data-plantilla): la pone
 * el script del layout antes de pintar, y acá se repone en las navegaciones
 * dentro de la app y se saca al salir, por la misma razón.
 */
export function StorefrontTheme({
  encontrate = false,
  plantilla = null,
}: {
  encontrate?: boolean;
  /** El id de la plantilla con tema, o null si la tienda no lleva piel. */
  plantilla?: string | null;
}) {
  useEffect(() => {
    const el = document.documentElement;
    el.dataset.theme = "dark";
    if (plantilla) el.dataset.plantilla = plantilla;
    else delete el.dataset.plantilla;
    if (encontrate) {
      try {
        if (localStorage.getItem(CLAVE_TEMA_TIENDA) === "oscura") el.dataset.tienda = "oscura";
      } catch {
        // sin almacenamiento, clara
      }
    }
    return () => {
      delete el.dataset.tienda;
      delete el.dataset.plantilla;
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
  }, [encontrate, plantilla]);

  return null;
}
