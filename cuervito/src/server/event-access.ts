import "server-only";

import { db } from "~/server/db";

export type EventRole = "OWNER" | "COLLABORATOR";

export type EventAccess = {
  role: EventRole;
  eventId: string;
  /** Dueño del evento. Siempre paga el storage y cobra las ventas, incluso
   *  cuando la foto la subió un colaborador. */
  ownerId: string;
};

/**
 * Resuelve qué puede hacer un usuario sobre un evento.
 *
 * - OWNER: creó el evento. Control total.
 * - COLLABORATOR: fue invitado y aceptó. Puede subir y ver fotos, pero no
 *   editar el evento, publicarlo, borrarlo ni tocar colaboradores.
 *
 * Devuelve null si no tiene ningún acceso. Las invitaciones PENDING o
 * REVOKED no dan acceso.
 */
export async function getEventAccess(
  eventId: string,
  userId: string,
): Promise<EventAccess | null> {
  const event = await db.event.findUnique({
    where: { id: eventId },
    select: { id: true, ownerId: true },
  });
  if (!event) return null;

  if (event.ownerId === userId) {
    return { role: "OWNER", eventId: event.id, ownerId: event.ownerId };
  }

  const collab = await db.eventCollaborator.findFirst({
    where: { eventId, userId, status: "ACCEPTED" },
    select: { id: true },
  });
  if (collab) {
    return { role: "COLLABORATOR", eventId: event.id, ownerId: event.ownerId };
  }

  return null;
}

/** Acceso de solo-subida: owner o colaborador aceptado. */
export async function canUploadToEvent(
  eventId: string,
  userId: string,
): Promise<EventAccess | null> {
  return getEventAccess(eventId, userId);
}

/** Acciones reservadas al dueño: editar, publicar, borrar, gestionar
 *  colaboradores y ver la recaudación. */
export async function isEventOwner(
  eventId: string,
  userId: string,
): Promise<boolean> {
  const access = await getEventAccess(eventId, userId);
  return access?.role === "OWNER";
}
