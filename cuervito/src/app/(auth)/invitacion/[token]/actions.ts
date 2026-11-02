"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth, signOut } from "~/server/auth";
import { db } from "~/server/db";

/**
 * Aceptar la invitación. Termina en el evento, en el panel: antes mandaba a
 * la ruta del panel viejo, y la pantalla del evento no dejaba entrar a un
 * colaborador, así que aceptar terminaba en un 404.
 */
export async function acceptCollaboratorInvite(formData: FormData) {
  const token = formData.get("token");
  if (typeof token !== "string" || !token) return;

  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/invitacion/${token}`)}`);
  }

  const invite = await db.eventCollaborator.findUnique({
    where: { inviteToken: token },
    select: {
      id: true,
      eventId: true,
      invitedEmail: true,
      status: true,
      userId: true,
    },
  });
  if (!invite) return;
  if (invite.invitedEmail.toLowerCase() !== session.user.email.toLowerCase()) return;

  // Apretar dos veces no es un error: ya está adentro, que vaya al evento.
  if (invite.status === "ACCEPTED" && invite.userId === session.user.id) {
    redirect(`/dashboard/evento/${invite.eventId}`);
  }
  if (invite.status !== "PENDING") return;

  await db.eventCollaborator.update({
    where: { id: invite.id },
    data: {
      status: "ACCEPTED",
      acceptedAt: new Date(),
      userId: session.user.id,
    },
  });

  revalidatePath(`/dashboard/evento/${invite.eventId}`);
  revalidatePath("/dashboard/eventos");
  revalidatePath("/dashboard");
  redirect(`/dashboard/evento/${invite.eventId}`);
}

/**
 * Cerrar la sesión que no es la invitada y volver a entrar con el mail de la
 * invitación ya puesto. Antes la pantalla decía «cerrá sesión y volvé a
 * entrar» y no daba cómo: quien llegaba desde el mail tenía que encontrar el
 * botón de salir en un panel que no conocía.
 */
export async function cambiarDeCuenta(formData: FormData) {
  const token = formData.get("token");
  if (typeof token !== "string" || !token) return;

  const invite = await db.eventCollaborator.findUnique({
    where: { inviteToken: token },
    select: { invitedEmail: true },
  });
  const callback = encodeURIComponent(`/invitacion/${token}`);
  const email = invite ? `&email=${encodeURIComponent(invite.invitedEmail)}` : "";
  await signOut({ redirectTo: `/login?callbackUrl=${callback}${email}` });
}
