"use server";

import { auth } from "~/server/auth";
import {
  cambiarEstado,
  enviarMensaje,
  marcarLeidoAdmin,
  mensajesDesde,
  type EstadoConversacion,
  type MensajeDTO,
  type ResultadoEnvio,
} from "~/server/chat";
import { db } from "~/server/db";

/** Quién es, y que sea admin. El rol viene de la sesión, no del navegador. */
async function admin(): Promise<string | null> {
  const session = await auth();
  return session?.user?.role === "ADMIN" && session.user.id ? session.user.id : null;
}

export async function responderAction(conversacionId: string, texto: string): Promise<ResultadoEnvio> {
  const adminId = await admin();
  if (!adminId) return { error: "No tenés acceso a esto." };
  const c = await db.conversacion.findUnique({ where: { id: conversacionId }, select: { userId: true } });
  if (!c) return { error: "Esa conversación ya no existe." };
  return enviarMensaje({ autorId: adminId, deAdmin: true, userId: c.userId, texto });
}

export async function leidoAdminAction(conversacionId: string): Promise<void> {
  if (!(await admin())) return;
  await marcarLeidoAdmin(conversacionId).catch(() => undefined);
}

export async function estadoAction(conversacionId: string, estado: EstadoConversacion): Promise<{ error: string | null }> {
  if (!(await admin())) return { error: "No tenés acceso a esto." };
  if (estado !== "ABIERTA" && estado !== "RESUELTA") return { error: "Estado inválido." };
  await cambiarEstado(conversacionId, estado);
  return { error: null };
}

/** Lo que llegó desde `desde` (ISO), para cuando el SSE se reconecta. */
export async function mensajesDesdeAction(conversacionId: string, desde: string): Promise<MensajeDTO[]> {
  if (!(await admin())) return [];
  return mensajesDesde(conversacionId, desde);
}
