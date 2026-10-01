import "server-only";

import type { UserRole } from "../../generated/prisma";

/**
 * Quién puede tocar un evento.
 *
 * El dueño, siempre. Un admin también, para moderar y dar soporte: abrir el
 * evento de otro, cambiarle o sacarle la portada, corregir los datos o el
 * precio, publicarlo o despublicarlo y sacar fotos.
 *
 * Lo que deja algo a nombre de quien lo hace —subir fotos, que quedarían del
 * admin y con sus ventas— y lo que no tiene vuelta —borrar el evento entero—
 * sigue siendo sólo del dueño, cada uno con su propio control. Por eso esto
 * no es un "dueño o admin" repartido en cada ruta: las que lo usan son las de
 * la lista de arriba, y ninguna más.
 */
export function puedeEditarEvento(
  ownerId: string | null | undefined,
  user: { id?: string; role?: UserRole } | null | undefined,
): boolean {
  if (!ownerId || !user?.id) return false;
  return ownerId === user.id || user.role === "ADMIN";
}
