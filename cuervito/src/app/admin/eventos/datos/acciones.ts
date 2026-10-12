"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { DISCIPLINAS } from "~/lib/disciplinas";
import { auth } from "~/server/auth";
import { db } from "~/server/db";

const datosSchema = z.object({
  eventId: z.string().min(1),
  discipline: z.enum(DISCIPLINAS).or(z.literal("")),
  location: z.string().trim().max(120),
});

/**
 * Disciplina y lugar de un evento ajeno, desde el panel de administración.
 *
 * Existe para completar los que quedaron vacíos antes de que fueran
 * obligatorios: de esos dos campos salen el título de la página, su párrafo y
 * las páginas por disciplina y ciudad. No toca nada más del evento.
 */
export async function guardarDatosEventoAction(entrada: unknown): Promise<{ error: string | null }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return { error: "No autorizado." };
  const d = datosSchema.safeParse(entrada);
  if (!d.success) return { error: "Revisá los datos." };
  await db.event.update({
    where: { id: d.data.eventId },
    data: { discipline: d.data.discipline || null, location: d.data.location || null },
    select: { id: true },
  });
  revalidatePath("/admin/eventos/datos");
  return { error: null };
}
