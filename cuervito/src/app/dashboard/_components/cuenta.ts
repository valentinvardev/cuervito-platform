"use server";

import { signOut } from "~/server/auth";

/** Cerrar sesión, desde el riel o desde el diálogo de perfil. */
export async function cerrarSesionAction() {
  await signOut({ redirectTo: "/login" });
}
