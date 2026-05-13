import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

import { env } from "~/env";
import { resolveSlugForHost } from "~/server/domain-map";

const PROTECTED_PREFIXES = ["/dashboard", "/admin"];

// Hostnames where we serve cuervito.app's regular routes directly.
const PRIMARY_HOSTS = new Set([
  "cuervito.app",
  "www.cuervito.app",
  "localhost",
]);

function isPrimaryHost(host: string): boolean {
  const h = host.toLowerCase().split(":")[0] ?? "";
  if (PRIMARY_HOSTS.has(h)) return true;
  // LAN IPs etc — anything that looks like an IPv4 — treat as primary too
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) return true;
  return false;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const host = req.headers.get("host") ?? "";

  // ─── Custom domain handling ──────────────────────────────────────────
  // If the request came in on a hostname we recognize as a photographer's
  // custom domain, rewrite the URL to /{slug}{pathname} so the existing
  // [slug] routes serve the right content. The browser keeps showing
  // anaphoto.com.ar — internal only.
  if (!isPrimaryHost(host)) {
    // Don't serve dashboard / admin / api / auth on custom domains —
    // redirect those back to cuervito.app.
    if (
      pathname.startsWith("/dashboard") ||
      pathname.startsWith("/admin") ||
      pathname.startsWith("/api") ||
      pathname.startsWith("/login") ||
      pathname.startsWith("/signup") ||
      pathname.startsWith("/onboarding")
    ) {
      const url = new URL(
        pathname + req.nextUrl.search,
        env.NEXT_PUBLIC_BASE_URL,
      );
      return NextResponse.redirect(url);
    }

    const slug = await resolveSlugForHost(host);
    if (slug) {
      // Map `/` → `/{slug}`, `/foo` → `/{slug}/foo` (event subpages, etc).
      const targetPath =
        pathname === "/" ? `/${slug}` : `/${slug}${pathname}`;
      const url = req.nextUrl.clone();
      url.pathname = targetPath;
      return NextResponse.rewrite(url);
    }
    // Unknown custom host → fall through and serve the normal 404.
  }

  // ─── Auth gates for dashboard/admin ─────────────────────────────────
  const needsAuth = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  if (!needsAuth) return NextResponse.next();

  const token = await getToken({ req, secret: env.AUTH_SECRET });
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/admin") && token.role !== "ADMIN") {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  if (token.status === "SUSPENDED" && pathname !== "/suspended") {
    const url = req.nextUrl.clone();
    url.pathname = "/suspended";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Match everything except Next internals and static files.
  // We need to inspect the Host header on every page request to detect
  // custom domains and rewrite to /{slug}/... when there's a match.
  matcher: [
    "/((?!_next/static|_next/image|assets/|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
