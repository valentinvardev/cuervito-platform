import Link from "next/link";
import { ReceiptText } from "lucide-react";

import { db } from "~/server/db";

import { hace, pesos, sesionV2 } from "../_components/sesion";
import { Lista } from "./_lista";

export const dynamic = "force-dynamic";

const DIAS = 30;

export default async function V2Ventas() {
  const { userId } = await sesionV2();

  const desde = new Date(Date.now() - DIAS * 86400000);

  const [resumen, ventas, fotos] = await Promise.all([
    db.sale.aggregate({
      _sum: { sellerNetCents: true },
      _count: true,
      where: { sellerId: userId, status: "PAID", paidAt: { gte: desde } },
    }),
    db.sale.findMany({
      where: { sellerId: userId, createdAt: { gte: desde } },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        buyerName: true,
        buyerEmail: true,
        sellerNetCents: true,
        status: true,
        createdAt: true,
        paidAt: true,
        // Para el cajón. Viajan con la lista porque son cuatro campos de la
        // misma fila: lo caro del detalle son las miniaturas, y ésas sí se
        // piden recién al abrir.
        downloadToken: true,
        downloadTokenExpires: true,
        downloadCount: true,
        event: { select: { name: true } },
        _count: { select: { items: true } },
      },
    }),
    db.saleItem.count({
      where: { sale: { sellerId: userId, status: "PAID", paidAt: { gte: desde } } },
    }),
  ]);

  const neto = resumen._sum.sellerNetCents ?? 0;

  return (
    <main className="canvas">
        <div className="canvas-in">
          <div className="head">
            <div>
              <h1>Ventas</h1>
              <p>
                {resumen._count} {resumen._count === 1 ? "venta" : "ventas"} en los últimos {DIAS} días.
              </p>
            </div>
          </div>

          {/* Una sola tarjeta con lo que ganó. La resta de la comisión no va
              acá: recordarle en cada pantalla cuánto se lleva la plataforma no
              lo ayuda a vender, y el número que le importa es el que le queda.
              El desglose vive en Métodos de pago. */}
          <section className="sum">
            <div className="card neto">
              <div className="k-lab">Ganaste en los últimos {DIAS} días</div>
              <div className="k-n tnum">{pesos(neto)}</div>
              <div className="k-sub">
                {resumen._count} ventas · {fotos.toLocaleString("es-AR")} fotos · ya en tu cuenta de
                Mercado Pago
              </div>
            </div>
          </section>

          <section className="card">
            {ventas.length > 0 ? (
              <Lista
                ventas={ventas.map((v) => ({
                  id: v.id,
                  quien: v.buyerName ?? v.buyerEmail,
                  mail: v.buyerEmail,
                  evento: v.event.name,
                  fotos: v._count.items,
                  neto: v.sellerNetCents,
                  estado: v.status,
                  fecha: (v.paidAt ?? v.createdAt).toISOString(),
                  hace: hace(v.createdAt),
                  descargas: v.downloadCount,
                  vence: v.downloadTokenExpires?.toISOString() ?? null,
                  token: v.downloadToken,
                }))}
              />
            ) : (
              <div className="empty">
                <div className="empty-i">
                  <ReceiptText />
                </div>
                <h3>No se encontraron ventas</h3>
                <p>
                  Pasale el link de tu evento al grupo del club o al organizador: es de donde vienen
                  casi todas las primeras ventas.
                </p>
                <Link href="/v2/eventos" className="btn btn-ghost">
                  Ver mis eventos
                </Link>
              </div>
            )}
          </section>
        </div>
      </main>
  );
}
