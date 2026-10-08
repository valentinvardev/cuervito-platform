"use client";

import { Moon, Sun } from "lucide-react";

import { CLAVE_TEMA_TIENDA } from "~/lib/tema-tienda";

/**
 * Claro u oscuro, en la plantilla de encontrate.
 *
 * Los dos íconos se dibujan siempre y el CSS decide cuál se ve, igual que el
 * botón del panel: el servidor no sabe qué eligió el visitante, y si el ícono
 * dependiera de un estado de React saldría el equivocado hasta hidratar.
 */
export function BotonTemaTienda() {
  function cambiar() {
    const raiz = document.documentElement;
    const oscura = raiz.dataset.tienda !== "oscura";
    if (oscura) raiz.dataset.tienda = "oscura";
    else delete raiz.dataset.tienda;
    try {
      localStorage.setItem(CLAVE_TEMA_TIENDA, oscura ? "oscura" : "clara");
    } catch {
      // almacenamiento bloqueado: dura lo que dure la pestaña
    }
  }

  return (
    <button type="button" className="et-btn et-btn-icono et-tema" onClick={cambiar} aria-label="Cambiar entre claro y oscuro">
      <Moon className="et-tema-luna" />
      <Sun className="et-tema-sol" />
    </button>
  );
}
