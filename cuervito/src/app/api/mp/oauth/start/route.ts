import { NextResponse, type NextRequest } from "next/server";

import { env } from "~/env";
import { auth } from "~/server/auth";
import { buildOAuthUrl, isMpConfigured } from "~/server/mp";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login?callbackUrl=/dashboard/cobros", req.url));
  }
  if (!isMpConfigured()) {
    return NextResponse.json(
      { error: "Mercado Pago no está configurado en este servidor." },
      { status: 500 },
    );
  }

  // Use the public base URL — req.url sees the localhost:3005 origin behind
  // the nginx proxy, but MP needs the exact URI we registered in their panel.
  const base = env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, "");
  const redirectUri = `${base}/api/mp/oauth/callback`;
  const url = buildOAuthUrl({ state: session.user.id, redirectUri });
  return NextResponse.redirect(url);
}
