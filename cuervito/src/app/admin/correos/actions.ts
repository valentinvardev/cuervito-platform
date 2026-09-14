"use server";

import { revalidatePath, revalidateTag } from "next/cache";

import { auth } from "~/server/auth";
import { CAMPANAS_IDS, type CampanaId } from "~/server/correos/campanas";
import { claveActiva, correrCorreos, enviarPrueba } from "~/server/correos/enviar";
import { db } from "~/server/db";
import { escribirBandera } from "~/server/settings";

async function admin() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") throw new Error("No autorizado");
  return session.user;
}

function esCampana(id: string): id is CampanaId {
  return (CAMPANAS_IDS as readonly string[]).includes(id);
}

/**
 * Prender o apagar una campaña.
 *
 * Prenderla no manda nada en el acto: la próxima pasada del remitente —cada
 * quince minutos— toma a los que califican y no la recibieron. Apagarla
 * tampoco borra nada: quien ya la recibió queda registrado, así que volver a
 * prenderla no repite.
 */
export async function toggleCampanaAction(id: string, activa: boolean): Promise<void> {
  const yo = await admin();
  if (!esCampana(id)) throw new Error("Campaña desconocida");
  await escribirBandera(claveActiva(id), activa);
  revalidateTag(`setting:${claveActiva(id)}`);
  await db.adminAction.create({
    data: {
      actorId: yo.id,
      action: activa ? "ENABLE_CAMPAIGN" : "DISABLE_CAMPAIGN",
      targetType: "Campaign",
      targetId: id,
    },
  });
  revalidatePath("/admin/correos");
}

/** La campaña, a mi propio mail, sin registrarla. Para verla antes de prender. */
export async function enviarPruebaAction(id: string): Promise<{ ok: boolean; detalle: string }> {
  const yo = await admin();
  if (!esCampana(id)) return { ok: false, detalle: "Campaña desconocida" };
  if (!yo.email) return { ok: false, detalle: "Tu cuenta no tiene mail" };
  const r = await enviarPrueba(id, yo.email, yo.name ?? null);
  return r
    ? { ok: true, detalle: `Enviado a ${yo.email}` }
    : { ok: false, detalle: "No hay proveedor de mail configurado (RESEND_API_KEY)" };
}

/** Una pasada ahora, sin esperar el tick. Dispara y vuelve. */
export async function correrAhoraAction(): Promise<void> {
  await admin();
  void correrCorreos().catch((e: unknown) => console.error("[admin correos]", e));
  revalidatePath("/admin/correos");
}
