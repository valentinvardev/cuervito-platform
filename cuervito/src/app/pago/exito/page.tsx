import Link from "next/link";

import { db } from "~/server/db";

export default async function PagoExitoPage(props: {
  searchParams: Promise<{ sale?: string }>;
}) {
  const sp = await props.searchParams;
  const saleId = sp.sale;

  const sale = saleId
    ? await db.sale.findUnique({
        where: { id: saleId },
        select: {
          id: true,
          status: true,
          totalCents: true,
          buyerEmail: true,
          downloadToken: true,
          event: { select: { name: true } },
        },
      })
    : null;

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "var(--bg-base)",
        color: "var(--text-primary)",
        fontFamily: "var(--font-ui)",
      }}
    >
      <div
        style={{
          maxWidth: 480,
          width: "100%",
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 18,
          padding: 36,
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 84,
            height: 84,
            borderRadius: "50%",
            background: "rgba(76,175,125,0.14)",
            border: "2px solid var(--success)",
            color: "var(--success)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px",
            fontSize: 44,
          }}
        >
          <i className="ti ti-check" />
        </div>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            fontSize: 28,
            letterSpacing: "-0.025em",
            marginBottom: 8,
          }}
        >
          ¡Pago confirmado!
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 22 }}>
          {sale ? (
            <>
              Gracias por tu compra de <strong>{sale.event.name}</strong>. Te enviamos los
              detalles a <strong>{sale.buyerEmail}</strong>.
            </>
          ) : (
            <>Estamos confirmando tu pago. En unos segundos vas a recibir el email con la descarga.</>
          )}
        </p>
        {sale?.downloadToken ? (
          <Link
            href={`/descarga/${sale.downloadToken}`}
            className="btn btn-primary"
            style={{ width: "100%", justifyContent: "center" }}
          >
            <i className="ti ti-download" />
            Descargar mis fotos
          </Link>
        ) : (
          <p style={{ color: "var(--text-tertiary)", fontSize: 13 }}>
            Si no recibís el email en unos minutos, escribinos a hola@cuervito.app.
          </p>
        )}
      </div>
    </main>
  );
}
