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
