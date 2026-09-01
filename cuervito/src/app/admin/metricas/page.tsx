import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "~/server/auth";
import { db } from "~/server/db";

/**
 * Métricas admin — foco en conversión.
 *
 * Por cada fotógrafo (PHOTOGRAPHER) mostramos:
 *  - Eventos publicados
 *  - Fotos subidas totales (no borradas)
 *  - Ventas pagadas
 *  - Fotos vendidas (SaleItems de sales PAID)
 *  - Recaudado bruto
 *  - Conversión = fotos vendidas por cada 1000 fotos subidas
 *
 * Orden por defecto: por conversión desc (mostrar los que mejor venden
 * relativo al inventario que suben).
 */
export default async function AdminMetricasPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/dashboard");

  const [photographers, salesAgg, itemsByEvent, photosByOwner, bySource, faceSearchAgg] =
    await Promise.all([
    db.user.findMany({
      where: { role: "PHOTOGRAPHER" },
      select: {
        id: true,
        name: true,
        email: true,
        slug: true,
        createdAt: true,
        _count: { select: { eventsOwned: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    // Total recaudado + count de ventas PAID por vendedor
    db.sale.groupBy({
      by: ["sellerId"],
      where: { status: "PAID" },
      _sum: { totalCents: true, sellerNetCents: true },
      _count: true,
    }),
    // Cantidad de SaleItems (fotos vendidas) por sellerId de sales PAID
    db.saleItem.groupBy({
      by: ["saleId"],
      _count: true,
    }),
    // Photo count (no soft-deleted) por owner
    db.photo.groupBy({
      by: ["ownerId"],
      where: { deletedAt: null },
      _count: true,
    }),
    // De dónde vino el comprador. Es el dato que define si Cuervito
    // cobra como mercado (genera demanda) o como herramienta (no).
    db.sale.groupBy({
      by: ["trafficSource"],
      where: { status: "PAID" },
      _sum: { totalCents: true },
      _count: true,
    }),
    db.faceSearchLog.aggregate({ _count: true, _avg: { matchCount: true } }),
  ]);

  const sourceRows = ["PLATFORM", "DIRECT", "UNKNOWN"].map((k) => {
    const row = bySource.find((r) => r.trafficSource === k);
    return {
      source: k,
      sales: row?._count ?? 0,
      grossCents: row?._sum.totalCents ?? 0,
    };
  });
  const attributedSales = sourceRows
    .filter((r) => r.source !== "UNKNOWN")
    .reduce((a, r) => a + r.sales, 0);
  const platformSales = sourceRows.find((r) => r.source === "PLATFORM")?.sales ?? 0;

  // Necesitamos mapear saleId → sellerId para agregar fotos vendidas por vendedor.
  // Traemos los sale.id → sellerId de las PAID.
  const paidSales = await db.sale.findMany({
    where: { status: "PAID" },
    select: { id: true, sellerId: true },
  });
  const saleToSeller = new Map(paidSales.map((s) => [s.id, s.sellerId]));
  const soldPhotosBySeller = new Map<string, number>();
  for (const row of itemsByEvent) {
    const seller = saleToSeller.get(row.saleId);
    if (!seller) continue;
    soldPhotosBySeller.set(seller, (soldPhotosBySeller.get(seller) ?? 0) + row._count);
  }

  const salesBySeller = new Map(
    salesAgg.map((r) => [
      r.sellerId,
      {
        salesCount: r._count,
        grossCents: r._sum.totalCents ?? 0,
        netCents: r._sum.sellerNetCents ?? 0,
      },
    ]),
  );
  const photosBySellerMap = new Map(
    photosByOwner.map((r) => [r.ownerId, r._count]),
  );

  type Row = {
    id: string;
    name: string | null;
    email: string | null;
    slug: string | null;
    eventsCount: number;
    photosCount: number;
    salesCount: number;
    soldPhotos: number;
    grossCents: number;
    netCents: number;
    /** Fotos vendidas por 1000 fotos subidas. Null si no subió fotos. */
    conversionPer1000: number | null;
  };

  const rows: Row[] = photographers.map((p) => {
    const sales = salesBySeller.get(p.id);
    const photos = photosBySellerMap.get(p.id) ?? 0;
    const sold = soldPhotosBySeller.get(p.id) ?? 0;
    return {
      id: p.id,
      name: p.name,
      email: p.email,
      slug: p.slug,
      eventsCount: p._count.eventsOwned,
      photosCount: photos,
      salesCount: sales?.salesCount ?? 0,
      soldPhotos: sold,
      grossCents: sales?.grossCents ?? 0,
      netCents: sales?.netCents ?? 0,
      conversionPer1000: photos > 0 ? (sold / photos) * 1000 : null,
    };
  });

  rows.sort((a, b) => (b.conversionPer1000 ?? -1) - (a.conversionPer1000 ?? -1));

  // Aggregate del top-level (KPIs)
  const totals = rows.reduce(
    (acc, r) => {
      acc.photographers += 1;
      acc.events += r.eventsCount;
      acc.photos += r.photosCount;
      acc.sold += r.soldPhotos;
      acc.gross += r.grossCents;
      return acc;
    },
    { photographers: 0, events: 0, photos: 0, sold: 0, gross: 0 },
  );
  const platformConversion =
    totals.photos > 0 ? (totals.sold / totals.photos) * 1000 : null;

  return (
    <main className="wrap-narrow">
      <div className="head">
        <h1>Métricas · admin</h1>
        <div className="sub">
          Cómo convierten los fotógrafos. La conversión se mide como fotos
          vendidas por cada 1.000 fotos subidas — sirve para comparar
          fotógrafos de distinto tamaño en un mismo eje.
        </div>
      </div>

      {/* Platform-level KPIs */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <Kpi
          label="Fotógrafos activos"
          value={totals.photographers.toLocaleString("es-AR")}
          icon="ti-users"
        />
        <Kpi
          label="Eventos totales"
          value={totals.events.toLocaleString("es-AR")}
          icon="ti-calendar-event"
        />
        <Kpi
          label="Fotos subidas"
          value={totals.photos.toLocaleString("es-AR")}
          icon="ti-photo"
        />
        <Kpi
          label="Fotos vendidas"
          value={totals.sold.toLocaleString("es-AR")}
          icon="ti-photo-check"
        />
        <Kpi
          label="Ventas / 1000 fotos"
          accent
          value={
            platformConversion == null
              ? "—"
              : platformConversion.toFixed(1)
          }
          icon="ti-chart-arrows"
        />
        <Kpi
          label="Recaudado bruto"
          value={`$${(totals.gross / 100).toLocaleString("es-AR")}`}
          icon="ti-cash"
        />
      </div>

      {/* Origen de las ventas — el dato que define el modelo de cobro */}
      <section className="src-panel">
        <div className="src-head">
          <div>
            <h2>Origen de las ventas</h2>
            <p>
              Si la mayoría llega por el link del fotógrafo, encontrate.app es una
              herramienta y la comisión es difícil de justificar. Si llega por
              el buscador, encontrate.app genera la demanda y la comisión vale.
            </p>
          </div>
          {attributedSales > 0 && (
            <div className="src-headline">
              <span className="src-headline-num">
                {((platformSales / attributedSales) * 100).toFixed(0)}%
              </span>
              <span className="src-headline-lbl">
                generado por
                <br />
                la plataforma
              </span>
            </div>
          )}
        </div>

        {attributedSales === 0 ? (
          <div className="src-empty">
            <i className="ti ti-clock" />
            <div>
              <strong>Todavía no hay ventas atribuidas.</strong>
              <span>
                La medición arranca desde ahora: las ventas anteriores figuran
                como sin atribuir porque no existía la cookie de origen.
              </span>
            </div>
          </div>
        ) : (
          <div className="src-rows">
            {sourceRows.map((r) => {
              const label =
                r.source === "PLATFORM"
                  ? "Buscador de encontrate.app"
                  : r.source === "DIRECT"
                    ? "Link del fotógrafo"
                    : "Sin atribuir";
              const icon =
                r.source === "PLATFORM"
                  ? "ti-search"
                  : r.source === "DIRECT"
                    ? "ti-share-3"
                    : "ti-help-circle";
              const base = attributedSales || 1;
              const pct = r.source === "UNKNOWN" ? 0 : (r.sales / base) * 100;
              return (
                <div key={r.source} className={`src-row ${r.source.toLowerCase()}`}>
                  <span className="src-icon">
                    <i className={`ti ${icon}`} />
                  </span>
                  <div className="src-info">
                    <div className="src-label">{label}</div>
                    <div className="src-bar">
                      <span style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div className="src-nums">
                    <span className="src-sales">
                      {r.sales.toLocaleString("es-AR")}{" "}
                      {r.sales === 1 ? "venta" : "ventas"}
                    </span>
                    <span className="src-gross">
                      ${(r.grossCents / 100).toLocaleString("es-AR")}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="src-foot">
          <i className="ti ti-scan-eye" />
          <span>
            {faceSearchAgg._count.toLocaleString("es-AR")} búsquedas por selfie
            registradas
            {faceSearchAgg._avg.matchCount != null &&
              ` · ${faceSearchAgg._avg.matchCount.toFixed(1)} fotos encontradas en promedio`}
          </span>
        </div>
      </section>

      {/* Table */}
      <section
        className="sales-card"
        style={{ overflowX: "auto", padding: "4px 0" }}
      >
        <table className="admin-sales-table">
          <thead>
            <tr>
              <th>Fotógrafo</th>
              <th style={{ textAlign: "right" }}>Eventos</th>
              <th style={{ textAlign: "right" }}>Fotos subidas</th>
              <th style={{ textAlign: "right" }}>Ventas</th>
              <th style={{ textAlign: "right" }}>Fotos vendidas</th>
              <th style={{ textAlign: "right" }}>Conv / 1000</th>
              <th style={{ textAlign: "right" }}>Recaudado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <div style={{ fontWeight: 500 }}>
                    <Link
                      href={`/admin/users/${r.id}`}
                      style={{ color: "var(--text-primary)" }}
                    >
                      {r.name ?? "(sin nombre)"}
                    </Link>
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--text-tertiary)",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {r.email ?? "—"}
                    {r.slug && ` · @${r.slug}`}
                  </div>
                </td>
                <td style={numCell}>{r.eventsCount.toLocaleString("es-AR")}</td>
                <td style={numCell}>{r.photosCount.toLocaleString("es-AR")}</td>
                <td style={numCell}>{r.salesCount.toLocaleString("es-AR")}</td>
                <td style={numCell}>{r.soldPhotos.toLocaleString("es-AR")}</td>
                <td
                  style={{
                    ...numCell,
                    color:
                      r.conversionPer1000 == null
                        ? "var(--text-tertiary)"
                        : r.conversionPer1000 >= 20
                          ? "var(--success)"
                          : r.conversionPer1000 >= 5
                            ? "var(--accent)"
                            : "var(--text-secondary)",
                    fontWeight: 500,
                  }}
                >
                  {r.conversionPer1000 == null
                    ? "—"
                    : r.conversionPer1000.toFixed(1)}
                </td>
                <td style={{ ...numCell, color: "var(--accent)" }}>
                  ${(r.grossCents / 100).toLocaleString("es-AR")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div
        style={{
          marginTop: 18,
          padding: "12px 14px",
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 10,
          fontSize: 12.5,
          color: "var(--text-tertiary)",
          lineHeight: 1.55,
        }}
      >
        <strong style={{ color: "var(--text-primary)" }}>Cómo leerlo:</strong>{" "}
        Conv/1000 &lt; 5 = baja (revisar precios, calidad, promoción).
        Entre 5 y 20 = saludable. &gt; 20 = excelente conversión (ejemplo
        para benchmark: cliente conoce evento y fotos son fáciles de encontrar).
      </div>
    </main>
  );
}

const numCell: React.CSSProperties = {
  textAlign: "right",
  fontFamily: "var(--font-mono)",
};

function Kpi({
  label,
  value,
  icon,
  accent = false,
}: {
  label: string;
  value: string;
  icon: string;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 12,
        padding: "14px 16px",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <span
        style={{
          width: 34,
          height: 34,
          borderRadius: 9,
          background: "var(--accent-deep)",
          color: "var(--accent)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 18,
          flexShrink: 0,
        }}
      >
        <i className={`ti ${icon}`} />
      </span>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 11,
            color: "var(--text-tertiary)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 18,
            letterSpacing: "-0.01em",
            color: accent ? "var(--accent)" : "var(--text-primary)",
          }}
        >
          {value}
        </div>
      </div>
    </div>
  );
}
