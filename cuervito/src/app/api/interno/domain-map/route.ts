import { NextResponse } from "next/server";

import { db } from "~/server/db";

// Node runtime — the middleware runs on Edge (can't use Prisma) so it fetches
// this endpoint every 60s to get the hostname → slug map. Payload is small
// (hundreds of rows max) and the data is effectively public (custom domains
// resolve to slugs anyway), so no auth is needed.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db.customDomain.findMany({
    where: { status: "ACTIVE" },
    select: {
      hostname: true,
      user: { select: { slug: true } },
    },
  });

  const entries: [string, string][] = [];
  for (const r of rows) {
    if (r.user.slug) entries.push([r.hostname.toLowerCase(), r.user.slug]);
  }

  return NextResponse.json({ entries });
}
