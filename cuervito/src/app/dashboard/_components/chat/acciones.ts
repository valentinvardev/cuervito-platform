"use server";

import { auth } from "~/server/auth";
import { enviarMensaje, hiloDeUsuario, marcarLeidoUsuario, type HiloUsuario, type ResultadoEnvio } from "~/server/chat";

/**
 * Las acciones de la burbuja. Cada una empieza por la sesión: el id del
 * usuario sale de ahí y de ningún otro lado, así nadie lee ni escribe el hilo
 * de otro.
 */

const VACIO: HiloUsuario = { estado: null, mensajes: [], noLeidos: 0, adminsEnLinea: false };

export async function hiloAction(desde?: string): Promise<HiloUsuario> {
  const session = await auth();
  if (!session?.user?.id) return VACIO;
  return hiloDeUsuario(session.user.id, desde);
}

export async function enviarAction(texto: string): Promise<ResultadoEnvio> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Tu sesión venció. Volvé a entrar." };
  return enviarMensaje({ autorId: session.user.id, deAdmin: false, userId: session.user.id, texto });
}

export async function leidoAction(): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) return;
  await marcarLeidoUsuario(session.user.id);
}
