import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

import { env } from "~/env";

const PROTECTED_PREFIXES = ["/dashboard", "/admin"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const needsAuth = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  if (!needsAuth) return NextResponse.next();

  const token = await getToken({ req, secret: env.AUTH_SECRET });
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  // Admin gate
  if (pathname.startsWith("/admin") && token.role !== "ADMIN") {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // Suspended gate
  if (token.status === "SUSPENDED" && pathname !== "/suspended") {
    const url = req.nextUrl.clone();
    url.pathname = "/suspended";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*"],
};
