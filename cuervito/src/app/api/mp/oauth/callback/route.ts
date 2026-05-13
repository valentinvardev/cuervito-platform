import { NextResponse, type NextRequest } from "next/server";

import { env } from "~/env";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { exchangeOAuthCode } from "~/server/mp";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  if (errorParam || !code || !state) {
    return NextResponse.redirect(
      new URL(`/dashboard/cobros?error=${encodeURIComponent(errorParam ?? "missing_code")}`, req.url),
    );
  }

  // Defensive: confirm the state matches the current user
  if (state !== session.user.id) {
    return NextResponse.redirect(new URL(`/dashboard/cobros?error=state_mismatch`, req.url));
  }

  // Must match exactly what we sent to MP in /start (and what's registered in
  // the MP panel). Using req.url here would give localhost behind the proxy.
  const base = env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, "");
  const redirectUri = `${base}/api/mp/oauth/callback`;

  try {
    const tokens = await exchangeOAuthCode({ code, redirectUri });
    const expiresAt = new Date(Date.now() + tokens.expiresInSeconds * 1000);

    await db.user.update({
      where: { id: session.user.id },
      data: {
        mpUserId: BigInt(tokens.userId),
        mpAccessToken: tokens.accessToken,
        mpRefreshToken: tokens.refreshToken,
        mpPublicKey: tokens.publicKey,
        mpTokenExpiresAt: expiresAt,
        mpLiveMode: tokens.liveMode,
        mpConnectedAt: new Date(),
        mpOnboardingSkipped: false,
      },
    });

    return NextResponse.redirect(new URL("/dashboard/cobros?connected=1", req.url));
  } catch (err) {
    console.error("[mp callback] failed:", err);
    return NextResponse.redirect(
      new URL(`/dashboard/cobros?error=oauth_failed`, req.url),
    );
  }
}
