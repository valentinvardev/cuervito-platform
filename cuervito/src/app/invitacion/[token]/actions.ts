"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { auth } from "~/server/auth";
import { db } from "~/server/db";

export async function acceptCollaboratorInvite(formData: FormData) {
  const token = formData.get("token");
  if (typeof token !== "string" || !token) return;

  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    redirect(`/login?callbackUrl=/invitacion/${token}`);
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
  if (!invite || invite.status !== "PENDING") return;

  if (invite.invitedEmail.toLowerCase() !== session.user.email.toLowerCase()) {
    return;
  }

  await db.eventCollaborator.update({
    where: { id: invite.id },
    data: {
      status: "ACCEPTED",
      acceptedAt: new Date(),
      userId: session.user.id,
    },
  });

  revalidatePath(`/dashboard/events/${invite.eventId}`);
  redirect(`/dashboard/events/${invite.eventId}`);
}
