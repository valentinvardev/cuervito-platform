import Link from "next/link";
import { redirect } from "next/navigation";
import { Clock, ScanFace } from "lucide-react";

import { auth } from "~/server/auth";
import { db } from "~/server/db";

export const dynamic = "force-dynamic";

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
      // De dónde vino el comprador. Es el dato que define si la plataforma
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
  const photosBySellerMap = new Map(photosByOwner.map((r) => [r.ownerId, r._count]));

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
  const platformConversion = totals.photos > 0 ? (totals.sold / totals.photos) * 1000 : null;

  const n = (x: number) => x.toLocaleString("es-AR");
  const pesos = (c: number) => `$${Math.round(c / 100).toLocaleString("es-AR")}`;

  return (
    <main className="canvas">
      <div className="canvas-in">
        <div className="head">
          <div>
            <h1>Métricas</h1>
            <p>
              Cómo convierten los fotógrafos. La conversión es fotos vendidas por cada 1.000
              subidas: sirve para comparar fotógrafos de distinto tamaño en un mismo eje.
            </p>
          </div>
        </div>

        <section className="sum k6">
          <Cifra rotulo="Fotógrafos" valor={n(totals.photographers)} />
          <Cifra rotulo="Eventos" valor={n(totals.events)} />
          <Cifra rotulo="Fotos subidas" valor={n(totals.photos)} />
          <Cifra rotulo="Fotos vendidas" valor={n(totals.sold)} />
          <Cifra
            rotulo="Ventas / 1.000 fotos"
            valor={platformConversion == null ? "—" : platformConversion.toFixed(1)}
            acento
          />
          <Cifra rotulo="Recaudado bruto" valor={pesos(totals.gross)} />
        </section>

        {/* Origen de las ventas: el dato que define el modelo de cobro. */}
        <section className="card">
          <div className="card-h">
            <div>
              <h2>Origen de las ventas</h2>
              <div className="sub">
                Si la mayoría llega por el link del fotógrafo, la plataforma es una herramienta y la
                comisión es difícil de justificar. Si llega por el buscador, la plataforma genera la
                demanda y la comisión vale.
              </div>
            </div>
            {attributedSales > 0 && (
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div className="tnum" style={{ fontSize: 30, fontWeight: 200, letterSpacing: "-0.035em", lineHeight: 1 }}>
                  {((platformSales / attributedSales) * 100).toFixed(0)}%
                </div>
                <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 4 }}>
                  generado por la plataforma
                </div>
              </div>
            )}
          </div>

          {attributedSales === 0 ? (
            <div className="empty" style={{ padding: "var(--s-5) var(--s-4)" }}>
              <div className="empty-i">
                <Clock />
              </div>
              <h3>Todavía no hay ventas atribuidas</h3>
              <p>
                La medición arranca desde ahora: las ventas anteriores figuran como sin atribuir
                porque no existía la cookie de origen.
              </p>
            </div>
          ) : (
            <div style={{ display: "grid", gap: "var(--s-3)" }}>
              {sourceRows.map((r) => {
                const label =
                  r.source === "PLATFORM"
                    ? "Buscador de encontrate.app"
                    : r.source === "DIRECT"
                      ? "Link del fotógrafo"
                      : "Sin atribuir";
                const base = attributedSales || 1;
                const pct = r.source === "UNKNOWN" ? 0 : (r.sales / base) * 100;
                return (
                  <div key={r.source} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: "var(--s-3)", alignItems: "center" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 500, marginBottom: 6 }}>{label}</div>
                      <div className="barra-p">
                        <i style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <div className="num" style={{ fontSize: 13, lineHeight: 1.4 }}>
                      <div className="tnum">
                        {n(r.sales)} {r.sales === 1 ? "venta" : "ventas"}
                      </div>
                      <div className="tnum" style={{ color: "var(--ink-3)", fontSize: 12 }}>{pesos(r.grossCents)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: "var(--s-4)", fontSize: 12.5, color: "var(--ink-3)" }}>
            <ScanFace style={{ width: 14, height: 14 }} />
            <span>
              {n(faceSearchAgg._count)} búsquedas por selfie
              {faceSearchAgg._avg.matchCount != null &&
                ` · ${faceSearchAgg._avg.matchCount.toFixed(1)} fotos encontradas en promedio`}
            </span>
          </div>
        </section>

        <section className="card">
          <div className="row row-h mt">
            <span>Fotógrafo</span>
            <span className="num oc">Eventos</span>
            <span className="num oc">Fotos</span>
            <span className="num oc">Ventas</span>
            <span className="num oc">Vendidas</span>
            <span className="num">Conv / 1.000</span>
            <span className="num">Recaudado</span>
          </div>
          {rows.map((r) => (
            <div key={r.id} className="row mt">
              <span className="v-who">
                <b>
                  <Link href={`/admin/users/${r.id}`} className="v-link">
                    {r.name ?? "(sin nombre)"}
                  </Link>
                </b>
                <span>
                  {r.email ?? "—"}
                  {r.slug && ` · @${r.slug}`}
                </span>
              </span>
              <span className="num soft oc tnum">{n(r.eventsCount)}</span>
              <span className="num soft oc tnum">{n(r.photosCount)}</span>
              <span className="num soft oc tnum">{n(r.salesCount)}</span>
              <span className="num soft oc tnum">{n(r.soldPhotos)}</span>
              <span
                className="num tnum"
                style={{
                  fontWeight: 500,
                  color:
                    r.conversionPer1000 == null
                      ? "var(--ink-3)"
                      : r.conversionPer1000 >= 20
                        ? "var(--ok-txt)"
                        : r.conversionPer1000 >= 5
                          ? "var(--acento-txt)"
                          : "var(--ink-2)",
                }}
              >
                {r.conversionPer1000 == null ? "—" : r.conversionPer1000.toFixed(1)}
              </span>
              <span className="num tnum neto">{pesos(r.grossCents)}</span>
            </div>
          ))}
          <p style={{ marginTop: "var(--s-4)", fontSize: 12.5, color: "var(--ink-3)", lineHeight: 1.55 }}>
            <b style={{ color: "var(--ink-2)", fontWeight: 500 }}>Cómo leerlo:</b> menos de 5 es
            baja (revisar precios, calidad, promoción). Entre 5 y 20, saludable. Más de 20, excelente:
            el atleta conoce el evento y las fotos son fáciles de encontrar.
          </p>
        </section>
      </div>
    </main>
  );
}

function Cifra({ rotulo, valor, acento = false }: { rotulo: string; valor: string; acento?: boolean }) {
  return (
    <div className={`card${acento ? " neto" : ""}`}>
      <div className="k-lab">{rotulo}</div>
      <div className="k-n tnum">{valor}</div>
    </div>
  );
}
