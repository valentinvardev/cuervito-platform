"use server";

import { revalidatePath, revalidateTag } from "next/cache";

import { auth } from "~/server/auth";
import { db } from "~/server/db";

/**
 * Cambiar el precio de un evento, y nada más.
 *
 * No reusa updateEventAction, que es la regla en el resto de /v2, y vale la
 * pena decir por qué: esa acción pide el formulario entero (nombre, fecha,
 * lugar, descripción) y termina en redirect a /dashboard/events/[id]. Mandarle
 * los demás campos "sin cambios" es exactamente cómo se borra una descripción
 * sin querer, y el redirect te saca del panel nuevo para dejarte en el viejo.
 *
 * Lo que sí se comparte es lo que importa: el mismo control de dueño y las
 * mismas etiquetas de caché.
 */
export async function guardarPrecioAction(
  eventId: string,
  precio: number,
): Promise<{ error?: string; guardado?: boolean }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Iniciá sesión de nuevo." };

  const ev = await db.event.findUnique({
    where: { id: eventId },
    select: { ownerId: true },
  });
  if (ev?.ownerId !== session.user.id) return { error: "Evento no encontrado." };

  // Mismo rango que el esquema del formulario de evento. El 0 se permite a
  // propósito: es como se regala una galería entera.
  if (!Number.isFinite(precio) || precio < 0 || precio > 10_000_000) {
    return { error: "Poné un precio entre $0 y $10.000.000." };
  }

  await db.event.update({
    where: { id: eventId },
    // pricePerPhoto es Decimal(10,2) en PESOS, no en centavos. Dividirlo por
    // cien acá dejaría el precio cien veces más barato, que es un error que ya
    // se cometió una vez leyéndolo.
    data: { pricePerPhoto: Math.round(precio * 100) / 100 },
  });

  revalidateTag(`user:${session.user.id}:dashboard`);
  revalidateTag(`user:${session.user.id}:events`);
  revalidatePath(`/v2/evento/${eventId}`);
  revalidatePath(`/dashboard/events/${eventId}`);

  return { guardado: true };
}
