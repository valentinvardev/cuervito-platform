import { redirect } from "next/navigation";

import { auth } from "~/server/auth";
import { db } from "~/server/db";

import { AdminSalesClient } from "./admin-sales-client";
import { loadMoreAdminSalesAction } from "./actions";

const RANGES = {
  "30d": 30,
  "7d": 7,
  today: 1,
  all: null,
} as const;
type Range = keyof typeof RANGES;

const INITIAL_PAGE_SIZE = 30;

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
  const range = ((sp.range as Range) ?? "30d") as Range;
  const status = sp.status ?? "all";
  const q = (sp.q ?? "").trim();

  const since =
    RANGES[range] != null
      ? new Date(Date.now() - RANGES[range]! * 24 * 60 * 60 * 1000)
      : null;

  const where = {
    ...(since ? { createdAt: { gte: since } } : {}),
    ...(status !== "all"
      ? { status: status as "PAID" | "PENDING" | "FAILED" | "REFUNDED" | "EXPIRED" }
      : {}),
    ...(q
      ? {
          OR: [
            { buyerEmail: { contains: q, mode: "insensitive" as const } },
            { buyerName: { contains: q, mode: "insensitive" as const } },
            { id: { contains: q } },
            { event: { name: { contains: q, mode: "insensitive" as const } } },
            { seller: { name: { contains: q, mode: "insensitive" as const } } },
            { seller: { email: { contains: q, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  // Traemos la primera tanda (30) + agregados globales en paralelo.
  const [initial, totalCount, paidAgg] = await Promise.all([
    loadMoreAdminSalesAction({
      range,
      status,
      q,
      offset: 0,
      take: INITIAL_PAGE_SIZE,
    }),
    db.sale.count({ where }),
    db.sale.aggregate({
      where: { ...where, status: "PAID" },
      _sum: { totalCents: true, platformFeeCents: true },
      _count: true,
    }),
  ]);

  const totals = {
    paidGross: paidAgg._sum.totalCents ?? 0,
    platformFee: paidAgg._sum.platformFeeCents ?? 0,
    paidCount: paidAgg._count,
    total: totalCount,
  };

  return (
    <AdminSalesClient
      initialRows={initial.rows}
      initialHasMore={initial.hasMore}
      range={range}
      status={status}
      q={q}
      totals={totals}
      pageSize={INITIAL_PAGE_SIZE}
    />
  );
}
