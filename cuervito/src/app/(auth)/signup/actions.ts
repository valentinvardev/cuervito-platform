"use server";

import { AuthError } from "next-auth";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { slugReservado } from "~/lib/slugs-reservados";
import { db } from "~/server/db";
import { signIn } from "~/server/auth";
import { sendEmail } from "~/server/email";
// La cuenta se crea con storefrontTemplate "encontrate" unas líneas más abajo,
// así que la bienvenida va siempre con la marca nueva.
import { welcomeEmailHtml } from "~/server/email-encontrate";

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
    const taken =
      slugReservado(slug) ||
      (await db.user.findUnique({ where: { slug }, select: { id: true } }));
    if (!taken) break;
    slug = `${base}-${i}`;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await db.user.create({
    data: {
      name,
      email,
      passwordHash,
      slug,
      role: "PHOTOGRAPHER",
      status: "ACTIVE",
      // La misma que el respaldo del catálogo (PLANTILLA_POR_DEFECTO), pero
      // anotada: si el respaldo cambia algún día, las cuentas que ya existen
      // conservan la página con la que empezaron.
      storefrontTemplate: "encontrate",
      // El registro con email ya tiene lo que pide /onboarding —nombre y
      // usuario— y manda directo al tablero, así que nadie pasa por ese paso.
      // Sin esta fecha la tienda y cada evento dan 404 para siempre: el
      // fotógrafo sube y publica, y nadie puede ver nada.
      onboardingCompletedAt: new Date(),
    },
  });

  // Welcome email — best-effort, never block signup
  void sendEmail({
    to: email,
    subject: "Bienvenido a encontrate",
    html: welcomeEmailHtml({
      name,
      hasMpConnected: false,
      hasFirstEvent: false,
    }),
  }).catch((err: unknown) => console.error("[signup] welcome email failed:", err));

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
