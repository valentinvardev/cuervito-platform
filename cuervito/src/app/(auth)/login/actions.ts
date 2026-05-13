"use server";

import { AuthError } from "next-auth";
import { signIn } from "~/server/auth";

export type LoginState = { error: string | null };

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const callbackUrl = String(formData.get("callbackUrl") ?? "/dashboard");

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: callbackUrl,
    });
    return { error: null };
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.type === "CredentialsSignin") {
        return { error: "Email o contraseña incorrectos." };
      }
      if (err.type === "AccessDenied") {
        return { error: "No podés acceder con esa cuenta." };
      }
      return { error: "Error de autenticación. Probá de nuevo." };
    }
    // signIn() throws a NEXT_REDIRECT internally on success — let it bubble.
    throw err;
  }
}
