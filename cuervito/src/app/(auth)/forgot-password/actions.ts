"use server";

import { randomBytes } from "node:crypto";
import { z } from "zod";

import { env } from "~/env";
import { db } from "~/server/db";
import { passwordResetEmailHtml, sendEmail } from "~/server/email";

export type ForgotPasswordState = {
  error: string | null;
  sent?: boolean;
};

const schema = z.object({ email: z.string().trim().toLowerCase().email() });

export async function requestPasswordResetAction(
  _prev: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const parsed = schema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: "Ingresá un email válido." };
  }

  // Always respond the same to avoid leaking which emails exist.
  const user = await db.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, name: true, email: true },
  });

  if (user?.email) {
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db.passwordResetToken.create({
      data: { userId: user.id, token, expiresAt },
    });

    const baseUrl = env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, "");
    const resetUrl = `${baseUrl}/reset-password/${token}`;

    void sendEmail({
      to: user.email,
      subject: "Reset de contraseña · cuervito",
      html: passwordResetEmailHtml({ name: user.name ?? "Hola", resetUrl }),
    }).catch((err: unknown) =>
      console.error("[forgot-password] email failed:", err),
    );
  }

  return { error: null, sent: true };
}
