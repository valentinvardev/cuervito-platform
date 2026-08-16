"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { busUserDashboardCache, slugify, uniqueSlug } from "~/app/dashboard/events/_nucleo";
import { auth } from "~/server/auth";
import { db } from "~/server/db";

import { COMISION_CON, COMISION_SIN } from "./tarifas";

/**
 * Crear un evento desde el asistente del panel nuevo.
 *
 * No reusa createEventAction porque aquélla recibe un FormData de un formulario
 * de una sola pantalla y no sabe nada de reconocimiento ni de comisión. Lo que
 * sí se comparte es cómo se arma la dirección: slugify y uniqueSlug son las
 * mismas, para que el panel viejo y el nuevo no generen links distintos a
 * partir del mismo nombre.
 *
 * No redirige: devuelve el id para que el cliente suba la portada —que viaja
 * aparte, como archivo— antes de mandar a la pantalla del evento.
 */
const esquema = z.object({
  name: z.string().trim().min(3, "Poné un nombre de al menos 3 letras.").max(120),
  location: z.string().trim().max(120).optional(),
  discipline: z.string().trim().max(60).optional(),
  eventDate: z.string().optional(),
  recognition: z.boolean(),
  pricePerPhoto: z.number().min(0).max(10_000_000),
});

export async function crearEventoAction(
  entrada: z.infer<typeof esquema>,
): Promise<{ error?: string; campo?: string; id?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Iniciá sesión de nuevo." };

  const parsed = esquema.safeParse(entrada);
  if (!parsed.success) {
    const primero = parsed.error.issues[0];
    return {
      error: primero?.message ?? "Revisá los campos.",
      campo: String(primero?.path[0] ?? ""),
    };
  }
  const d = parsed.data;

  const slug = await uniqueSlug(slugify(d.name), session.user.id);

  const ev = await db.event.create({
    data: {
      ownerId: session.user.id,
      slug,
      name: d.name,
      location: d.location ?? null,
      discipline: d.discipline ?? null,
      eventDate: d.eventDate ? new Date(d.eventDate) : null,
      pricePerPhoto: d.pricePerPhoto,
      recognition: d.recognition,
      // Se guarda el número, no se deduce del booleano al cobrar: si mañana
      // cambian los porcentajes, los eventos ya creados tienen que seguir con
      // el que se les prometió al crearlos.
      platformFeePct: d.recognition ? COMISION_CON : COMISION_SIN,
      // Nace en borrador. Publicar es una decisión aparte y se toma cuando las
      // fotos ya están arriba: un evento publicado y vacío es un link que se
      // reparte y no muestra nada.
      status: "DRAFT",
    },
    select: { id: true },
  });

  busUserDashboardCache(session.user.id);
  revalidatePath("/v2/eventos");
  revalidatePath("/dashboard/events");

  return { id: ev.id };
}
