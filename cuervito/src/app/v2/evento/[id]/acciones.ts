"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  busUserDashboardCache,
  purgarEvento,
  slugify,
  uniqueSlug,
} from "~/app/dashboard/events/_nucleo";
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

  busUserDashboardCache(session.user.id);
  revalidatePath(`/v2/evento/${eventId}`);
  revalidatePath(`/dashboard/events/${eventId}`);

  return { guardado: true };
}

/* ═══════════════════════════════════════════════════════════════════════════
   Editar el evento sin salir del panel nuevo.

   Antes esta pantalla mandaba a /dashboard/events/[id]/edit, que es un
   formulario aparte y termina en el panel viejo: se editaba el evento y se
   volvía a otra interfaz.

   Lo que NO se duplica: slugify y uniqueSlug son las mismas de siempre,
   importadas. Dos maneras de armar la dirección de un evento significan que un
   día el panel viejo y el nuevo generan links distintos para el mismo nombre.
   ═══════════════════════════════════════════════════════════════════════════ */

const datos = z.object({
  name: z.string().min(3, "Poné un nombre de al menos 3 letras.").max(120),
  location: z.string().max(120).optional(),
  discipline: z.string().max(60).optional(),
  eventDate: z.string().optional(),
  description: z.string().max(2000).optional(),
});

export async function guardarDatosAction(
  eventId: string,
  entrada: z.infer<typeof datos>,
): Promise<{ error?: string; campo?: string; guardado?: boolean; slug?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Iniciá sesión de nuevo." };

  const ev = await db.event.findUnique({
    where: { id: eventId },
    select: { ownerId: true, slug: true, name: true },
  });
  if (ev?.ownerId !== session.user.id) return { error: "Evento no encontrado." };

  const parsed = datos.safeParse(entrada);
  if (!parsed.success) {
    const primero = parsed.error.issues[0];
    return { error: primero?.message ?? "Revisá los campos.", campo: String(primero?.path[0] ?? "") };
  }
  const d = parsed.data;

  // El nombre manda sobre la dirección, igual que en el panel viejo. Es una
  // decisión con costo —los links repartidos dejan de funcionar— pero cambiarla
  // sólo acá haría que el mismo evento tenga una dirección distinta según por
  // dónde lo edites. La pantalla lo avisa antes de guardar.
  let slug = ev.slug;
  if (d.name !== ev.name) {
    slug = await uniqueSlug(slugify(d.name), session.user.id, eventId);
  }

  await db.event.update({
    where: { id: eventId },
    data: {
      name: d.name,
      slug,
      location: d.location?.trim() ?? null,
      discipline: d.discipline?.trim() ?? null,
      eventDate: d.eventDate ? new Date(d.eventDate) : null,
      description: d.description?.trim() ?? null,
    },
  });

  busUserDashboardCache(session.user.id);
  revalidatePath(`/v2/evento/${eventId}`);
  revalidatePath(`/dashboard/events/${eventId}`);
  revalidatePath("/v2/eventos");

  return { guardado: true, slug };
}

/**
 * Publicar o despublicar.
 *
 * No reusa togglePublishedAction sólo porque aquélla devuelve void y acá hace
 * falta saber en qué estado quedó para no tener que recargar la pantalla
 * entera. La regla de negocio sí es la misma, incluido pasar de BORRADOR a
 * ACTIVO al publicar: sin eso el evento sale publicado pero con el cartel de
 * borrador en la página pública.
 */
export async function publicarAction(
  eventId: string,
): Promise<{ error?: string; publicado?: boolean }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Iniciá sesión de nuevo." };

  const ev = await db.event.findUnique({
    where: { id: eventId },
    select: { ownerId: true, isPublished: true, status: true, _count: { select: { photos: true } } },
  });
  if (ev?.ownerId !== session.user.id) return { error: "Evento no encontrado." };

  const proximo = !ev.isPublished;
  if (proximo && ev._count.photos === 0) {
    return { error: "Subí al menos una foto antes de publicar." };
  }

  await db.event.update({
    where: { id: eventId },
    data: {
      isPublished: proximo,
      ...(proximo && ev.status === "DRAFT" ? { status: "ACTIVE" as const } : {}),
    },
  });

  busUserDashboardCache(session.user.id);
  revalidatePath(`/v2/evento/${eventId}`);
  revalidatePath("/v2/eventos");
  revalidatePath(`/dashboard/events/${eventId}`);

  return { publicado: proximo };
}

/**
 * Borrar, y volver a /v2/eventos en vez de al panel viejo.
 *
 * El borrado en sí es purgarEvento, compartido con deleteEventAction: el
 * barrido de S3, la colección de Rekognition y el archivar-en-vez-de-borrar
 * cuando hay ventas son demasiado consecuentes como para tener dos versiones.
 */
export async function borrarEventoAction(eventId: string): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Iniciá sesión de nuevo." };

  const r = await purgarEvento(eventId, session.user.id);
  if (!r) return { error: "Evento no encontrado." };

  busUserDashboardCache(session.user.id);
  revalidatePath("/v2/eventos");
  revalidatePath("/dashboard/events");
  redirect("/v2/eventos");
}
