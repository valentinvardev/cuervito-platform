import { NextResponse, type NextRequest } from "next/server";

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

  const redirectUri = new URL("/api/mp/oauth/callback", req.url).toString();
  const url = buildOAuthUrl({ state: session.user.id, redirectUri });
  return NextResponse.redirect(url);
}
