"use server";

import { z } from "zod";

import { avisarAlFotografo } from "~/server/correos/espera";
import { db } from "~/server/db";

export type PedidoEstado =
  | { estado: "inicial" }
  | { estado: "listo"; email: string | null }
  | { estado: "publicado" }
  | { estado: "error"; mensaje: string };

/**
 * Hasta cuántas personas se anotan por evento. Muy por encima de lo que
 * junta un evento real; existe para que el formulario no sirva para cargar
 * diez mil direcciones ajenas que después recibirían un mail nuestro.
 */
const TOPE_POR_EVENTO = 500;

const esquema = z.object({
  eventId: z.string().min(1).max(40),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254)
    .email("Ese mail no parece válido.")
    .or(z.literal("")),
  // Campo trampa: invisible para una persona, irresistible para un bot.
  web: z.string().max(0).optional(),
});

/**
 * «Avisarle al fotógrafo», desde la página de un evento sin publicar.
 *
 * Sin sesión, como todo lo del comprador. El mail es opcional: sin él igual
 * se le avisa al fotógrafo; con él, además, le escribimos a esta persona
 * cuando el evento salga.
 */
export async function pedirPublicacionAction(
  _prev: PedidoEstado,
  formData: FormData,
): Promise<PedidoEstado> {
  const datos = esquema.safeParse({
    eventId: formData.get("eventId"),
    email: formData.get("email") ?? "",
    web: formData.get("web") ?? undefined,
  });
  if (!datos.success) {
    const deEmail = datos.error.issues.find((i) => i.path[0] === "email");
    if (deEmail) return { estado: "error", mensaje: deEmail.message };
    // El bot llenó el campo trampa (o mandó cualquier cosa): se le dice que
    // salió bien y no se hace nada.
    return { estado: "listo", email: null };
  }

  const { eventId, email } = datos.data;

  const ev = await db.event.findUnique({
    where: { id: eventId },
    select: { isPublished: true, status: true, _count: { select: { esperas: true } } },
  });
  if (!ev || ev.status === "ARCHIVED") {
    return { estado: "error", mensaje: "Este evento ya no está disponible." };
  }
  // Se publicó mientras la página estaba abierta.
  if (ev.isPublished) return { estado: "publicado" };

  if (email && ev._count.esperas < TOPE_POR_EVENTO) {
    try {
      await db.esperaEvento.create({ data: { eventId, email } });
    } catch (e) {
      // Ya estaba anotado: para esta persona es lo mismo.
      if ((e as { code?: string }).code !== "P2002") throw e;
    }
  }

  /* El aviso al fotógrafo no puede tumbar el pedido: si falla el proveedor de
     mail, el mail de esta persona ya quedó guardado, que es lo que importa. */
  await avisarAlFotografo(eventId).catch((e: unknown) =>
    console.error("[evento privado] aviso al fotógrafo falló:", e),
  );

  return { estado: "listo", email: email || null };
}
