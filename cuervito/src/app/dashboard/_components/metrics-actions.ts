"use server";

import { auth } from "~/server/auth";
import { db } from "~/server/db";

export type MetricsRange = "7d" | "30d" | "90d" | "1y";

export type PhotographerMetrics = {
  range: MetricsRange;
  /** Serie diaria de recaudación en centavos, para el gráfico. */
  series: { date: string; cents: number; sales: number }[];
  /** Neto que le queda al fotógrafo (post comisión de plataforma). */
  netCents: number;
  grossCents: number;
  salesCount: number;
  photosSold: number;
  /** Fotos publicadas (no borradas) en eventos del usuario. */
  photosUploaded: number;
  /** Fotos vendidas por cada 1.000 subidas. Null si no subió nada. */
  conversionPer1000: number | null;
  /** Ticket promedio en centavos. Null si no hubo ventas. */
  avgTicketCents: number | null;
  /** Variación % del neto contra el período inmediatamente anterior. */
  deltaPct: number | null;
  /** Top 5 eventos por recaudación en el período. */
  topEvents: {
    id: string;
    name: string;
    netCents: number;
    salesCount: number;
    photosSold: number;
  }[];
  /** Descargas registradas en el período. */
  downloads: number;
};

const RANGE_DAYS: Record<MetricsRange, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "1y": 365,
};

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function getPhotographerMetrics(
  range: MetricsRange,
): Promise<PhotographerMetrics | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const userId = session.user.id;

  const days = RANGE_DAYS[range] ?? 30;
  const now = new Date();
  const since = new Date(now.getTime() - days * 86400_000);
  // Ventana anterior del mismo largo, para calcular la variación.
  const prevSince = new Date(since.getTime() - days * 86400_000);

  const [sales, prevAgg, photosUploaded, downloads] = await Promise.all([
    db.sale.findMany({
      where: { sellerId: userId, status: "PAID", paidAt: { gte: since } },
      select: {
        id: true,
        paidAt: true,
        totalCents: true,
        sellerNetCents: true,
        eventId: true,
        event: { select: { name: true } },
        _count: { select: { items: true } },
      },
      orderBy: { paidAt: "asc" },
    }),
    db.sale.aggregate({
      where: {
        sellerId: userId,
        status: "PAID",
        paidAt: { gte: prevSince, lt: since },
      },
      _sum: { sellerNetCents: true },
    }),
    db.photo.count({ where: { ownerId: userId, deletedAt: null } }),
    db.downloadLog.count({
      where: { sale: { sellerId: userId }, createdAt: { gte: since } },
    }),
  ]);

  // ── Serie diaria ────────────────────────────────────────────────
  // Pre-sembramos todos los días del rango en cero para que el gráfico
  // no tenga huecos y el eje X sea uniforme.
  const buckets = new Map<string, { cents: number; sales: number }>();
  for (let i = 0; i <= days; i++) {
    buckets.set(dayKey(new Date(since.getTime() + i * 86400_000)), {
      cents: 0,
      sales: 0,
    });
  }

  let grossCents = 0;
  let netCents = 0;
  let photosSold = 0;
  const byEvent = new Map<
    string,
    { name: string; netCents: number; salesCount: number; photosSold: number }
  >();

  for (const s of sales) {
    grossCents += s.totalCents;
    netCents += s.sellerNetCents;
    photosSold += s._count.items;

    const key = dayKey(s.paidAt ?? now);
    const b = buckets.get(key);
    if (b) {
      b.cents += s.sellerNetCents;
      b.sales += 1;
    }

    const ev = byEvent.get(s.eventId) ?? {
      name: s.event.name,
      netCents: 0,
      salesCount: 0,
      photosSold: 0,
    };
    ev.netCents += s.sellerNetCents;
    ev.salesCount += 1;
    ev.photosSold += s._count.items;
    byEvent.set(s.eventId, ev);
  }

  const prevNet = prevAgg._sum.sellerNetCents ?? 0;
  const deltaPct =
    prevNet > 0
      ? ((netCents - prevNet) / prevNet) * 100
      : netCents > 0
        ? 100
        : null;

  const topEvents = [...byEvent.entries()]
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.netCents - a.netCents)
    .slice(0, 5);

  return {
    range,
    series: [...buckets.entries()].map(([date, v]) => ({ date, ...v })),
    netCents,
    grossCents,
    salesCount: sales.length,
    photosSold,
    photosUploaded,
    conversionPer1000:
      photosUploaded > 0 ? (photosSold / photosUploaded) * 1000 : null,
    avgTicketCents: sales.length > 0 ? Math.round(grossCents / sales.length) : null,
    deltaPct,
    topEvents,
    downloads,
  };
}
