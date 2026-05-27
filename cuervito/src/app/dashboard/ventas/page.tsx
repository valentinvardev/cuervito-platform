import { redirect } from "next/navigation";

import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { getPresignedDownloadUrl } from "~/server/s3";
import { resolveMediaUrl } from "~/server/media";

import { VentasClient, type SaleRow } from "./ventas-client";

const RANGES = {
  "30d": 30,
  "7d": 7,
  today: 1,
  all: null,
} as const;
type Range = keyof typeof RANGES;

export default async function VentasPage(props: {
  searchParams: Promise<{ event?: string; range?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/dashboard/ventas");

  const sp = await props.searchParams;
  const range = (sp.range ?? "30d") as Range;
  const eventFilter = sp.event && sp.event !== "all" ? sp.event : null;

  const since =
    RANGES[range] != null
      ? new Date(Date.now() - RANGES[range]! * 24 * 60 * 60 * 1000)
      : null;

  const events = await db.event.findMany({
    where: { ownerId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true },
  });

  const sales = await db.sale.findMany({
    where: {
      sellerId: session.user.id,
      ...(eventFilter ? { eventId: eventFilter } : {}),
      ...(since ? { createdAt: { gte: since } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      status: true,
      totalCents: true,
      platformFeeCents: true,
      sellerNetCents: true,
      buyerEmail: true,
      buyerName: true,
      createdAt: true,
      paidAt: true,
      downloadCount: true,
      downloadToken: true,
      downloadTokenExpires: true,
      event: { select: { id: true, name: true, slug: true } },
      items: {
        take: 1,
        select: {
          photo: { select: { previewKey: true, storageKey: true, bibNumbers: true } },
        },
      },
      _count: { select: { items: true } },
    },
  });

  const rows: SaleRow[] = await Promise.all(
    sales.map(async (s) => {
      const firstPhoto = s.items[0]?.photo;
      const thumbKey = firstPhoto?.previewKey ?? firstPhoto?.storageKey ?? null;
      const thumbUrl = thumbKey
        ? await resolveMediaUrl(thumbKey).catch(() => null)
        : null;
      return {
        id: s.id,
        status: s.status,
        totalCents: s.totalCents,
        platformFeeCents: s.platformFeeCents,
        sellerNetCents: s.sellerNetCents,
        buyerEmail: s.buyerEmail,
        buyerName: s.buyerName,
        createdAt: s.createdAt.toISOString(),
        paidAt: s.paidAt?.toISOString() ?? null,
        downloadCount: s.downloadCount,
        downloadToken: s.downloadToken,
        downloadTokenExpires: s.downloadTokenExpires?.toISOString() ?? null,
        eventName: s.event.name,
        eventSlug: s.event.slug,
        firstBib: firstPhoto?.bibNumbers ?? null,
        itemCount: s._count.items,
        thumbUrl,
      };
    }),
  );

  const totals = rows.reduce(
    (acc, r) => {
      if (r.status === "PAID") {
        acc.paidCents += r.sellerNetCents;
        acc.paidCount += 1;
      } else if (r.status === "PENDING") {
        acc.pendingCount += 1;
      }
      return acc;
    },
    { paidCents: 0, paidCount: 0, pendingCount: 0 },
  );

  return (
    <VentasClient
      rows={rows}
      events={events}
      eventFilter={eventFilter ?? "all"}
      range={range}
      totals={totals}
    />
  );
}
