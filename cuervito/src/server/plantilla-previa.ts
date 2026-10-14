import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";

import { TEMPLATES, type TemplateId } from "~/lib/storefront-templates";
import { auth } from "~/server/auth";

/**
 * Probar una plantilla en la tienda propia antes de elegirla.
 *
 * El modal de plantillas de Mi página muestra la tienda del fotógrafo en un
 * iframe con la plantilla que está mirando, sin guardarla. Un parámetro en
 * la URL no alcanza: la plantilla también la lee el layout de la tienda
 * (fuentes, variables de color), y los layouts no reciben searchParams. Una
 * cookie llega a los dos.
 *
 * La cookie la pone previsualizarPlantillaAction y sólo vale para la DUEÑA
 * de la tienda: si llega a la tienda de otro, o sin sesión, se ignora. Y
 * dura diez minutos: si el modal se cerró sin elegir, no queda la página
 * propia disfrazada mucho rato.
 */

export const COOKIE_PREVIA = "previa-plantilla";
export const PREVIA_MAX_AGE = 10 * 60;

const IDS = new Set<string>(TEMPLATES.map((t) => t.id));

export function esPlantilla(id: string): id is TemplateId {
  return IDS.has(id);
}

/** Una sola consulta de sesión por pedido, aunque layout y página pregunten los dos. */
const sesionCacheada = cache(() => auth());

/**
 * La plantilla con la que se dibuja la tienda de `user`: la que probaba la
 * dueña si hay previa y es ella, o la guardada.
 */
export const plantillaEfectiva = cache(
  async (user: { id: string; storefrontTemplate: string | null }): Promise<string | null> => {
    const previa = (await cookies()).get(COOKIE_PREVIA)?.value;
    if (!previa || !esPlantilla(previa)) return user.storefrontTemplate;
    const sesion = await sesionCacheada();
    if (sesion?.user?.id !== user.id) return user.storefrontTemplate;
    return previa;
  },
);
