import { NextResponse } from "next/server";

import { auth } from "~/server/auth";
import { db } from "~/server/db";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await db.user.update({
    where: { id: session.user.id },
    data: {
      mpUserId: null,
      mpAccessToken: null,
      mpRefreshToken: null,
      mpPublicKey: null,
      mpTokenExpiresAt: null,
      mpLiveMode: false,
      mpConnectedAt: null,
    },
  });

  return NextResponse.json({ ok: true });
}
