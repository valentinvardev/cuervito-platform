"use server";

import { auth } from "~/server/auth";
import { db } from "~/server/db";

import type { AdminSaleRow } from "./admin-sales-client";

// Prisma enum values for Sale.status
const VALID_STATUS = new Set(["PAID", "PENDING", "FAILED", "REFUNDED", "EXPIRED"]);

const RANGES: Record<string, number | null> = {
  today: 1,
  "7d": 7,
  "30d": 30,
  all: null,
};

/**
 * Devuelve una tanda más de ventas para la vista admin. El client
 * pasa los filtros actuales + offset actual; devolvemos los próximos
 * `take` items ordenados por createdAt desc, junto con si quedan más.
 */
export async function loadMoreAdminSalesAction(input: {
  range: string;
  status: string;
  q: string;
  offset: number;
  take: number;
}): Promise<{ rows: AdminSaleRow[]; hasMore: boolean }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return { rows: [], hasMore: false };

  const rangeDays = RANGES[input.range] ?? 30;
  const since = rangeDays != null
    ? new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000)
    : null;

  const q = input.q.trim();
  const take = Math.max(1, Math.min(500, input.take));
  const skip = Math.max(0, input.offset);

  const where = {
    ...(since ? { createdAt: { gte: since } } : {}),
    ...(input.status !== "all" && VALID_STATUS.has(input.status)
      ? { status: input.status as "PAID" | "PENDING" | "FAILED" | "REFUNDED" | "EXPIRED" }
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

  const sales = await db.sale.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip,
    take: take + 1, // pedimos uno extra para saber si hay más
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

  const hasMore = sales.length > take;
  const trimmed = hasMore ? sales.slice(0, take) : sales;

  const rows: AdminSaleRow[] = trimmed.map((s) => ({
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

  return { rows, hasMore };
}
