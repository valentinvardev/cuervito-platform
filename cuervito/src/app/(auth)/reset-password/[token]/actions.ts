"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";

import { db } from "~/server/db";

export type ResetPasswordState = {
  error: string | null;
  done?: boolean;
};

const schema = z.object({
  token: z.string().min(20),
  password: z.string().min(8).max(120),
});

export async function resetPasswordAction(
  _prev: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const parsed = schema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "La contraseña tiene que tener al menos 8 caracteres." };
  }

  const row = await db.passwordResetToken.findUnique({
    where: { token: parsed.data.token },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  });

  if (!row || row.usedAt || row.expiresAt < new Date()) {
    return { error: "Este link es inválido o ya venció. Pedí uno nuevo." };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  await db.$transaction([
    db.user.update({
      where: { id: row.userId },
      data: { passwordHash },
    }),
    db.passwordResetToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    }),
    // Burn any other unused tokens for this user — defense in depth
    db.passwordResetToken.updateMany({
      where: {
        userId: row.userId,
        id: { not: row.id },
        usedAt: null,
      },
      data: { usedAt: new Date() },
    }),
  ]);

  return { error: null, done: true };
}
