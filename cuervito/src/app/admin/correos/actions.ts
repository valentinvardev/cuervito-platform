"use server";

import { revalidatePath, revalidateTag } from "next/cache";

import { auth } from "~/server/auth";
import { enviarPruebaCompartir, ID_COMPARTIR } from "~/server/correos/compartir";
import { CORREOS_IDS, claveActiva, correrCorreos, enviarPrueba, type CorreoId } from "~/server/correos/enviar";
import { db } from "~/server/db";
import { escribirBandera } from "~/server/settings";

async function admin() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") throw new Error("No autorizado");
  return session.user;
}

function esCampana(id: string): id is CorreoId {
  return (CORREOS_IDS as readonly string[]).includes(id);
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
  /* El error se devuelve como texto y no se tira. Una acción que tira llega
     al navegador como una excepción sin mensaje —en producción Next lo borra
     a propósito— y, sin quien la ataje, tira abajo la pantalla entera con
     "Application error". El motivo de verdad (Resend que rechaza el remitente,
     el tope del día, lo que sea) es justo lo que hay que ver acá. */
  let r: string | null;
  try {
    r =
      id === ID_COMPARTIR
        ? await enviarPruebaCompartir(yo.email, yo.id, yo.name ?? null)
        : await enviarPrueba(id, yo.email, yo.name ?? null);
  } catch (e) {
    console.error(`[admin correos] la prueba de ${id} falló:`, e);
    return { ok: false, detalle: `No se mandó: ${e instanceof Error ? e.message : String(e)}` };
  }
  return r
    ? { ok: true, detalle: `Enviado a ${yo.email}` }
    : {
        ok: false,
        detalle:
          id === ID_COMPARTIR
            ? "No se mandó: hace falta un evento publicado con fotos procesadas, y RESEND_API_KEY"
            : "No hay proveedor de mail configurado (RESEND_API_KEY)",
      };
}

/** Una pasada ahora, sin esperar el tick. Dispara y vuelve. */
export async function correrAhoraAction(): Promise<void> {
  await admin();
  void correrCorreos().catch((e: unknown) => console.error("[admin correos]", e));
  revalidatePath("/admin/correos");
}
