import { redirect } from "next/navigation";

import { auth } from "~/server/auth";
import { db } from "~/server/db";

import { AdminSalesClient, type AdminSaleRow } from "./admin-sales-client";

const RANGES = {
  "30d": 30,
  "7d": 7,
  today: 1,
  all: null,
} as const;
type Range = keyof typeof RANGES;

export default async function AdminSalesPage(props: {
  searchParams: Promise<{
    range?: string;
    status?: string;
    q?: string;
  }>;
}) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/dashboard");

  const sp = await props.searchParams;
  const range = (sp.range ?? "30d") as Range;
  const status = sp.status ?? "all";
  const q = (sp.q ?? "").trim();

  const since =
    RANGES[range] != null
      ? new Date(Date.now() - RANGES[range]! * 24 * 60 * 60 * 1000)
      : null;

  const sales = await db.sale.findMany({
    where: {
      ...(since ? { createdAt: { gte: since } } : {}),
      ...(status !== "all" ? { status: status as "PAID" | "PENDING" | "FAILED" | "REFUNDED" | "EXPIRED" } : {}),
      ...(q
        ? {
            OR: [
              { buyerEmail: { contains: q, mode: "insensitive" } },
              { buyerName: { contains: q, mode: "insensitive" } },
              { id: { contains: q } },
              { event: { name: { contains: q, mode: "insensitive" } } },
              { seller: { name: { contains: q, mode: "insensitive" } } },
              { seller: { email: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 300,
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
      event: { select: { name: true, slug: true } },
      seller: { select: { name: true, email: true, slug: true } },
      _count: { select: { items: true } },
    },
  });

  const rows: AdminSaleRow[] = sales.map((s) => ({
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
    eventName: s.event.name,
    sellerName: s.seller.name ?? s.seller.email ?? "—",
    sellerSlug: s.seller.slug ?? null,
    itemCount: s._count.items,
  }));

  // Aggregate KPIs across the same filter
  const totals = rows.reduce(
    (acc, r) => {
      if (r.status === "PAID") {
        acc.paidGross += r.totalCents;
        acc.platformFee += r.platformFeeCents;
        acc.paidCount += 1;
      }
      acc.total += 1;
      return acc;
    },
    { paidGross: 0, platformFee: 0, paidCount: 0, total: 0 },
  );

  return (
    <AdminSalesClient
      rows={rows}
      range={range}
      status={status}
      q={q}
      totals={totals}
    />
  );
}
