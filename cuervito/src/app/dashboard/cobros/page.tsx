import { redirect } from "next/navigation";

import { env } from "~/env";
import { auth } from "~/server/auth";
import { db } from "~/server/db";

import { CobrosClient } from "./cobros-client";

export default async function CobrosPage(props: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const sp = await props.searchParams;
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/dashboard/cobros");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      email: true,
      mpUserId: true,
      mpConnectedAt: true,
      mpLiveMode: true,
    },
  });
  if (!user) redirect("/login");

  return (
    <CobrosClient
      email={user.email ?? ""}
      mpUserId={user.mpUserId?.toString() ?? null}
      mpConnectedAt={user.mpConnectedAt?.toISOString() ?? null}
      mpLiveMode={user.mpLiveMode}
      mpConfigured={!!env.MP_CLIENT_ID && !!env.MP_CLIENT_SECRET}
      platformFeePercent={env.PLATFORM_FEE_PERCENT}
      successFlag={sp.connected === "1"}
      errorParam={sp.error ?? null}
    />
  );
}
