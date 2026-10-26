import "server-only";

import type { UserRole } from "../../generated/prisma";
import { db } from "~/server/db";

/**
 * Quién es cada uno para un evento, en un solo lugar.
 *
 * Tres personas pueden entrar a un evento y no pueden lo mismo:
 *
 *   dueño        — lo creó. Todo: datos, precio, portada, publicar, invitar,
 *                  borrar, y cualquier foto.
 *   colaborador  — lo invitaron y aceptó. Sube fotos, y toca SÓLO las que
 *                  subió. No ve las ventas de los demás ni cambia nada del
 *                  evento.
 *   admin        — modera y da soporte: datos, precio, portada, publicar y
 *                  sacar fotos. No sube —las fotos quedarían a su nombre— ni
 *                  invita ni borra el evento.
 *
 * Antes esto estaba en dos módulos con dos preguntas distintas: uno sabía del
 * colaborador y el otro no. La pantalla del evento se escribió con el que no
 * sabía, y al colaborador que aceptaba una invitación lo recibía un 404. Una
 * sola función para una sola pregunta es lo que evita que vuelva a pasar.
 */

export type RolEnEvento = "duenio" | "colaborador" | "admin";

export type AccesoEvento = {
  rol: RolEnEvento;
  /** Dueño del evento. Siempre paga el almacenamiento y cobra las ventas,
   *  incluso cuando la foto la subió un colaborador. */
  ownerId: string;
};

type Usuario = { id?: string; role?: UserRole } | null | undefined;

/**
 * Sin ir a la base: para las rutas que ya tienen el ownerId en la mano y
 * sólo necesitan saber si quien mira es el dueño o un admin. Las acciones de
 * dueño (datos, precio, portada, publicar) usan esto.
 */
export function puedeEditarEvento(ownerId: string | null | undefined, user: Usuario): boolean {
  if (!ownerId || !user?.id) return false;
  return ownerId === user.id || user.role === "ADMIN";
}

/**
 * El rol de este usuario sobre este evento, o null si no tiene ninguno. Las
 * invitaciones pendientes o revocadas no dan acceso.
 *
 * Un admin que además es colaborador es colaborador: está ahí a título
 * propio, con sus fotos y su comisión, y no moderando.
 */
export async function accesoEvento(eventId: string, user: Usuario): Promise<AccesoEvento | null> {
  if (!user?.id) return null;
  const ev = await db.event.findUnique({ where: { id: eventId }, select: { ownerId: true } });
  if (!ev) return null;
  if (ev.ownerId === user.id) return { rol: "duenio", ownerId: ev.ownerId };

  const colab = await db.eventCollaborator.findFirst({
    where: { eventId, userId: user.id, status: "ACCEPTED" },
    select: { id: true },
  });
  if (colab) return { rol: "colaborador", ownerId: ev.ownerId };

  if (user.role === "ADMIN") return { rol: "admin", ownerId: ev.ownerId };
  return null;
}

/** Subir fotos: el dueño y los colaboradores. El admin no. */
export async function puedeSubirAlEvento(eventId: string, user: Usuario): Promise<AccesoEvento | null> {
  const a = await accesoEvento(eventId, user);
  return a && a.rol !== "admin" ? a : null;
}

/**
 * Qué fotos del evento puede tocar: borrar, bajar el original. El dueño y el
 * admin, cualquiera; el colaborador, las que subió él. Es un filtro para
 * sumar al `where` de Prisma, así la misma regla sirve para una foto o para
 * quinientas.
 */
export function filtroFotosPropias(acceso: AccesoEvento, userId: string): { uploadedById?: string } {
  return acceso.rol === "colaborador" ? { uploadedById: userId } : {};
}
