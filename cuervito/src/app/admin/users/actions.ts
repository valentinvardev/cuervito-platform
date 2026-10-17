"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "~/server/auth";
import { db } from "~/server/db";
import type { Prisma } from "../../../../generated/prisma";

async function assertAdmin(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");
  return session.user.id;
}

/** Un campo del formulario como texto; un archivo u otra cosa cuenta como vacío. */
function campo(fd: FormData, nombre: string): string {
  const v = fd.get(nombre);
  return typeof v === "string" ? v : "";
}

async function logAction(
  actorId: string,
  action: string,
  targetType: string,
  targetId: string,
  metadata?: Prisma.InputJsonValue,
) {
  await db.adminAction.create({
    data: { actorId, action, targetType, targetId, metadata: metadata ?? {} },
  });
}

// ──────────────────────────────────────────────────────────────────────────
// Suspend / reactivate
// ──────────────────────────────────────────────────────────────────────────

export async function suspendUserAction(formData: FormData): Promise<void> {
  const actorId = await assertAdmin();
  const targetId = String(formData.get("userId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim() || null;
  if (!targetId) return;

  if (targetId === actorId) {
    // Can't suspend yourself
    return;
  }

  await db.user.update({
    where: { id: targetId },
    data: {
      status: "SUSPENDED",
      suspendedAt: new Date(),
      suspendedReason: reason,
    },
  });
  await logAction(actorId, "SUSPEND_USER", "User", targetId, { reason });

  revalidatePath(`/admin/users/${targetId}`);
  revalidatePath("/admin/users");
}

export async function reactivateUserAction(formData: FormData): Promise<void> {
  const actorId = await assertAdmin();
  const targetId = String(formData.get("userId") ?? "");
  if (!targetId) return;

  await db.user.update({
    where: { id: targetId },
    data: { status: "ACTIVE", suspendedAt: null, suspendedReason: null },
  });
  await logAction(actorId, "REACTIVATE_USER", "User", targetId);

  revalidatePath(`/admin/users/${targetId}`);
  revalidatePath("/admin/users");
}

// ──────────────────────────────────────────────────────────────────────────
// Role change
// ──────────────────────────────────────────────────────────────────────────

export async function setUserRoleAction(formData: FormData): Promise<void> {
  const actorId = await assertAdmin();
  const targetId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "");
  if (!targetId || (role !== "PHOTOGRAPHER" && role !== "ADMIN")) return;

  if (targetId === actorId) {
    // Can't demote yourself — would lock you out
    return;
  }

  await db.user.update({
    where: { id: targetId },
    data: { role },
  });
  await logAction(actorId, "SET_ROLE", "User", targetId, { role });

  revalidatePath(`/admin/users/${targetId}`);
  revalidatePath("/admin/users");
}

// ──────────────────────────────────────────────────────────────────────────
// Regalar fotos
// ──────────────────────────────────────────────────────────────────────────

/**
 * Habilitar o deshabilitar que esta cuenta pueda regalar fotos.
 *
 * Con el permiso puesto, una compra cuyo total dé CERO —porque el evento está
 * a precio cero, o porque un descuento cubrió todo— se entrega directo, sin
 * pasar por Mercado Pago, y queda registrada en estado GIFT.
 *
 * Es un permiso de la plataforma y no una opción del fotógrafo a propósito.
 * Poner un evento en cero se pudo siempre —el formulario acepta el cero desde
 * el principio, y hasta ahora eso simplemente rompía el checkout—, así que si
 * el cero por sí solo repartiera fotos gratis, cualquiera se lo encontraría de
 * casualidad al equivocarse escribiendo el precio.
 *
 * Queda en el log de admin porque es un permiso que reparte contenido sin
 * cobrar: si mañana aparece una galería entera entregada gratis, tiene que
 * poder responderse quién habilitó qué y cuándo.
 */
export async function toggleGiftAction(formData: FormData): Promise<void> {
  const actorId = await assertAdmin();
  const targetId = String(formData.get("userId") ?? "");
  const enabled = String(formData.get("enabled") ?? "") === "1";
  if (!targetId) return;

  await db.user.update({
    where: { id: targetId },
    data: { giftEnabled: enabled },
  });
  await logAction(actorId, enabled ? "ENABLE_GIFT" : "DISABLE_GIFT", "User", targetId);

  revalidatePath(`/admin/users/${targetId}`);
  revalidatePath("/admin/users");
}

// ──────────────────────────────────────────────────────────────────────────
// Estudio de historias
// ──────────────────────────────────────────────────────────────────────────

/**
 * Darle (o sacarle) el estudio de historias a esta cuenta.
 *
 * Es la tercera llave además del rol ADMIN y de la lista en Setting, y la
 * que usa la campaña de mail que invita a probarlo. Existe porque las otras
 * dos no sirven para repartir: promover a ADMIN da el panel entero, y la
 * lista en Setting es una cadena separada por comas que nadie debería editar
 * desde un formulario.
 */
export async function toggleHistoriasAction(formData: FormData): Promise<void> {
  const actorId = await assertAdmin();
  const targetId = String(formData.get("userId") ?? "");
  const enabled = String(formData.get("enabled") ?? "") === "1";
  if (!targetId) return;

  await db.user.update({
    where: { id: targetId },
    data: { historiasEnabled: enabled },
  });
  await logAction(actorId, enabled ? "ENABLE_HISTORIAS" : "DISABLE_HISTORIAS", "User", targetId);

  revalidatePath(`/admin/users/${targetId}`);
  revalidatePath("/admin/users");
}

// ──────────────────────────────────────────────────────────────────────────
// Quota overrides
// ──────────────────────────────────────────────────────────────────────────

const quotaSchema = z.object({
  userId: z.string(),
  storageGB: z.string(),
  recognitionMonthly: z.string(),
});

export type QuotaState = { error: string | null; saved?: boolean };

export async function setQuotasAction(
  _prev: QuotaState,
  formData: FormData,
): Promise<QuotaState> {
  const actorId = await assertAdmin();
  const parsed = quotaSchema.safeParse({
    userId: formData.get("userId"),
    storageGB: formData.get("storageGB"),
    recognitionMonthly: formData.get("recognitionMonthly"),
  });
  if (!parsed.success) return { error: "Datos inválidos." };

  const storageGB = parsed.data.storageGB === "" ? null : Number(parsed.data.storageGB);
  const recMonthly =
    parsed.data.recognitionMonthly === "" ? null : Number(parsed.data.recognitionMonthly);

  if (storageGB !== null && (Number.isNaN(storageGB) || storageGB < 0 || storageGB > 100000)) {
    return { error: "Storage en GB tiene que ser un número entre 0 y 100000." };
  }
  if (
    recMonthly !== null &&
    (Number.isNaN(recMonthly) || recMonthly < 0 || recMonthly > 10_000_000)
  ) {
    return { error: "Recognition limit tiene que ser un número entre 0 y 10.000.000." };
  }

  const storageBytes = storageGB === null ? null : BigInt(Math.floor(storageGB * 1024 * 1024 * 1024));

  await db.user.update({
    where: { id: parsed.data.userId },
    data: {
      storageQuotaBytes: storageBytes,
      recognitionQuotaMonthly: recMonthly,
    },
  });

  await logAction(actorId, "OVERRIDE_QUOTA", "User", parsed.data.userId, {
    storageBytes: storageBytes?.toString() ?? null,
    recognitionMonthly: recMonthly,
  });

  revalidatePath(`/admin/users/${parsed.data.userId}`);
  return { error: null, saved: true };
}

// ──────────────────────────────────────────────────────────────────────────
// Dominio propio
// ──────────────────────────────────────────────────────────────────────────

/**
 * Conectar un dominio del fotógrafo a su tienda.
 *
 * Acá sólo se anota el mapa hostname → fotógrafo (CustomDomain, ACTIVE):
 * es lo que lee el middleware para reescribir el dominio a /{slug}. Que el
 * dominio llegue hasta acá es DNS, y eso se hace en Cloudflare, a mano:
 * su zona en nuestra cuenta, CNAME del dominio y de www a encontrate.app,
 * SSL en «Full». El cliente de Cloudflare for SaaS (server/cloudflare.ts)
 * queda para el día que esto sea autoservicio.
 *
 * Se cargan el dominio pelado y su www juntos: la gente escribe cualquiera
 * de los dos y los dos tienen que abrir la tienda.
 */
const HOSTNAME = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.[a-z0-9-]{1,63})+$/;
const NUESTROS = ["encontrate.app", "cuervito.app"];

function normalizarHostname(crudo: string): string | null {
  let h = crudo.trim().toLowerCase();
  h = h.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");
  if (!HOSTNAME.test(h)) return null;
  if (NUESTROS.some((n) => h === n || h.endsWith(`.${n}`))) return null;
  return h;
}

export async function agregarDominioAction(formData: FormData): Promise<void> {
  const actorId = await assertAdmin();
  const targetId = campo(formData, "userId");
  if (!targetId) return;
  const hostname = normalizarHostname(campo(formData, "hostname"));
  if (!hostname) redirect(`/admin/users/${targetId}?dominio=invalido`);

  const hostnames = [hostname, `www.${hostname}`];
  const ajenos = await db.customDomain.findMany({
    where: { hostname: { in: hostnames }, userId: { not: targetId } },
    select: { hostname: true },
  });
  if (ajenos.length > 0) redirect(`/admin/users/${targetId}?dominio=ocupado`);

  for (const h of hostnames) {
    await db.customDomain.upsert({
      where: { hostname: h },
      create: { userId: targetId, hostname: h, status: "ACTIVE", verifiedAt: new Date() },
      update: { status: "ACTIVE", verifiedAt: new Date(), errorMessage: null },
    });
  }
  await logAction(actorId, "ADD_DOMAIN", "User", targetId, { hostname });

  revalidatePath(`/admin/users/${targetId}`);
}

export async function quitarDominioAction(formData: FormData): Promise<void> {
  const actorId = await assertAdmin();
  const targetId = campo(formData, "userId");
  const id = campo(formData, "id");
  if (!targetId || !id) return;

  const fila = await db.customDomain.findFirst({ where: { id, userId: targetId }, select: { hostname: true } });
  if (!fila) return;
  await db.customDomain.delete({ where: { id } });
  await logAction(actorId, "REMOVE_DOMAIN", "User", targetId, { hostname: fila.hostname });

  revalidatePath(`/admin/users/${targetId}`);
}
