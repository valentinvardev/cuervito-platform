import Link from "next/link";
import { redirect } from "next/navigation";

import { db } from "~/server/db";

/**
 * Legacy entry point. The whole confirmation flow now lives inside
 * /descarga/[token] with ?fresh=1 (same page where the photo grid lives,
 * so the celebration → grid happens in-place without a navigation).
 *
 * If MP hasn't fired the webhook yet, we render a thin "still processing"
 * page that auto-refreshes every 2 seconds via a meta refresh.
 */
export default async function PagoProcesandoPage(props: {
  searchParams: Promise<{ sale?: string }>;
}) {
  const sp = await props.searchParams;
  const saleId = sp.sale;
  if (!saleId) redirect("/");

  const sale = await db.sale.findUnique({
    where: { id: saleId },
    select: { status: true, downloadToken: true },
  });

  if (!sale) {
    return (
      <main className="pago-wrap">
        <h1>No encontramos tu compra</h1>
        <p className="lede">
          El identificador no coincide con ninguna venta. Si pagaste recién,
          esperá unos segundos y refrescá.
        </p>
        <Link href="/" className="btn btn-outline">
          Volver al inicio
        </Link>
      </main>
    );
  }

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

  if (sale.status === "PAID" && sale.downloadToken) {
    redirect(`/descarga/${sale.downloadToken}?fresh=1`);
  }

  // PENDING — webhook hasn't landed yet. Light auto-refresh page until it does.
  return (
    <main className="pago-wrap" style={{ textAlign: "center" }}>
      <meta httpEquiv="refresh" content="2" />
      <div
        style={{
          width: 60,
          height: 60,
          borderRadius: "50%",
          border: "3px solid rgba(255,255,255,0.1)",
          borderTopColor: "var(--accent)",
          margin: "0 auto 20px",
          animation: "spin 1s linear infinite",
        }}
      />
      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 800,
          fontSize: 28,
          letterSpacing: "-0.02em",
          marginBottom: 8,
        }}
      >
        Confirmando tu pago…
      </h1>
      <p style={{ color: "var(--text-secondary)", fontSize: 14, margin: 0 }}>
        Mercado Pago está procesando. No cierres esta página.
      </p>
    </main>
  );
}
