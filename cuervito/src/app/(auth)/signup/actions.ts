"use server";

import { AuthError } from "next-auth";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { db } from "~/server/db";
import { signIn } from "~/server/auth";

export type SignupState = { error: string | null };

const signupSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(120),
});

function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export async function signupAction(
  _prev: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "Revisá los datos. La contraseña tiene que tener al menos 8 caracteres." };
  }

  const { name, email, password } = parsed.data;

  const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    return { error: "Ya hay una cuenta con ese email." };
  }

  const base = slugify(name) || "fotografo";
  let slug = base;
  for (let i = 2; i < 50; i++) {
    const taken = await db.user.findUnique({ where: { slug }, select: { id: true } });
    if (!taken) break;
    slug = `${base}-${i}`;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await db.user.create({
    data: { name, email, passwordHash, slug, role: "PHOTOGRAPHER", status: "ACTIVE" },
  });

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/dashboard",
    });
    return { error: null };
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: "Cuenta creada pero el login falló. Probá iniciar sesión." };
    }
    throw err; // NEXT_REDIRECT
  }
}
