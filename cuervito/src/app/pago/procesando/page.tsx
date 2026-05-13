import Link from "next/link";

import { db } from "~/server/db";

import { ProcesandoClient } from "./procesando-client";

export default async function PagoProcesandoPage(props: {
  searchParams: Promise<{ sale?: string }>;
}) {
  const sp = await props.searchParams;
  const saleId = sp.sale;

  if (!saleId) {
    return (
      <main className="pago-wrap">
        <h1>No encontramos tu compra</h1>
        <p className="lede">
          El link parece incompleto. Si recién pagaste, revisá tu email — el
          link de descarga llega ahí también.
        </p>
        <Link href="/" className="btn btn-outline">
          Volver al inicio
        </Link>
      </main>
    );
  }

  const sale = await db.sale.findUnique({
    where: { id: saleId },
    select: {
      id: true,
      status: true,
      totalCents: true,
      buyerEmail: true,
      buyerName: true,
      downloadToken: true,
      event: { select: { name: true } },
      _count: { select: { items: true } },
    },
  });

  if (!sale) {
    return (
      <main className="pago-wrap">
        <h1>No encontramos tu compra</h1>
        <p className="lede">
          El identificador no coincide con ninguna venta. Si pagaste hace
          poco, esperá unos segundos y refrescá.
        </p>
        <Link href="/" className="btn btn-outline">
          Volver al inicio
        </Link>
      </main>
    );
  }

  // If the sale already finished in a non-recoverable state, short-circuit.
  if (
    sale.status === "FAILED" ||
    sale.status === "REFUNDED" ||
    sale.status === "EXPIRED"
  ) {
    return (
      <main className="pago-wrap">
        <h1>Tu pago no se aprobó</h1>
        <p className="lede">
          Algo falló durante el cobro. No te preocupes — no se hizo ningún
          cargo. Podés volver e intentar de nuevo.
        </p>
        <Link href="/" className="btn btn-primary">
          Volver al evento
        </Link>
      </main>
    );
  }

  return (
    <ProcesandoClient
      saleId={sale.id}
      initialStatus={sale.status}
      initialDownloadToken={sale.downloadToken}
      buyerName={sale.buyerName ?? "Comprador"}
      buyerEmail={sale.buyerEmail}
      photoCount={sale._count.items}
      totalCents={sale.totalCents}
      eventName={sale.event.name}
    />
  );
}
