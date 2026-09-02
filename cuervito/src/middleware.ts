import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

import { env } from "~/env";
import { resolveSlugForHost } from "~/server/domain-map";

const PROTECTED_PREFIXES = ["/dashboard", "/admin"];

// Hostnames where we serve cuervito.app's regular routes directly.
/* Los dominios que son NUESTROS, no de un fotógrafo.

   Todo host que no esté acá se trata como dominio personalizado: se busca
   a qué fotógrafo pertenece y se reescribe a /{slug}. Por eso encontrate.app
   tiene que estar en la lista — sin esto, /login y /dashboard en el dominio
   nuevo redirigían de vuelta a cuervito.app, que fue exactamente lo que
   pasó al apuntar el DNS.

   cuervito.app se queda para siempre. Está en los mails ya enviados, en los
   links de descarga que la gente guardó y en las biografías de Instagram de
   los fotógrafos. Sacarlo rompe todo eso de golpe. */
const PRIMARY_HOSTS = new Set([
  "encontrate.app",
  "www.encontrate.app",
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

/* El dominio viejo. Sigue resolviendo y sigue sirviendo la app —está en los
   mails ya enviados y en los links que la gente guardó— pero manda a todo el
   mundo al nuevo, a la MISMA ruta: cuervito.app/casa termina en
   encontrate.app/casa. */
const HOSTS_VIEJOS = new Set(["cuervito.app", "www.cuervito.app"]);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const host = req.headers.get("host") ?? "";
  const h = host.toLowerCase().split(":")[0] ?? "";

  /* ─── El dominio viejo al nuevo, misma ruta ──────────────────────────

     Se preserva el path Y la query. La query no es un detalle: ?src=demo es
     lo que atribuye de dónde vino la visita, y perderlo en el salto
     falsearía las métricas de todo el que llegue por un link viejo.

     /api/ QUEDA AFUERA, y es lo único delicado de esto. Mercado Pago guarda
     el notification_url ADENTRO de cada preferencia, así que todas las
     ventas creadas antes del cambio de dominio le van a pegar a
     cuervito.app/api/mp/webhook. MP no sigue redirecciones al entregar un
     webhook: si esto redirigiera /api/, esas ventas nunca se marcarían como
     pagadas y el comprador nunca recibiría sus fotos.

     301 y no 307: es una mudanza de dominio de verdad, y es lo que le dice a
     Google que mueva el posicionamiento al dominio nuevo. Los navegadores lo
     cachean fuerte, así que conviene probarlo antes de darlo por hecho. */
  if (HOSTS_VIEJOS.has(h) && !pathname.startsWith("/api/")) {
    const destino = new URL(pathname + req.nextUrl.search, "https://encontrate.app");
    return NextResponse.redirect(destino, 301);
  }

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
