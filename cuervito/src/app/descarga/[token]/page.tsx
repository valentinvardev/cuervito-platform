import { notFound } from "next/navigation";

import { db } from "~/server/db";
import { getPresignedDownloadUrl } from "~/server/s3";

import { DescargaClient } from "./descarga-client";

export default async function DescargaPage(props: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ fresh?: string }>;
}) {
  const { token } = await props.params;
  const sp = await props.searchParams;
  // `fresh=1` is set by /pago/exito and the test-mode checkout when the
  // buyer arrives right after paying. It triggers the in-page payment
  // confirmation animation on top of the grid.
  const fresh = sp.fresh === "1";

  const sale = await db.sale.findUnique({
    where: { downloadToken: token },
    select: {
      id: true,
      buyerEmail: true,
      buyerName: true,
      status: true,
      downloadTokenExpires: true,
      event: { select: { name: true, slug: true } },
      items: {
        select: {
          photo: {
            select: {
              id: true,
              filename: true,
              storageKey: true,
              previewKey: true,
              bibNumbers: true,
            },
          },
        },
      },
    },
  });

  if (!sale) notFound();
  if (sale.status !== "PAID") {
    return (
      <ExpiredOrUnpaid
        message="El pago todavía no fue confirmado."
        sub="Si recién pagaste, esperá unos minutos y volvé a abrir el link."
      />
    );
  }
  if (sale.downloadTokenExpires && sale.downloadTokenExpires < new Date()) {
    return (
      <ExpiredOrUnpaid
        message="El link de descarga venció."
        sub="Escribinos a hola@cuervito.app y te generamos uno nuevo."
      />
    );
  }

  // Sign preview URLs for the thumbnails
  const photos = await Promise.all(
    sale.items
      .map((it) => it.photo)
      .filter(<T,>(p: T): p is NonNullable<T> => p !== null)
      .map(async (p) => ({
        id: p.id,
        filename: p.filename,
        bibNumbers: p.bibNumbers,
        previewUrl: await getPresignedDownloadUrl(p.previewKey ?? p.storageKey, {
          expiresIn: 60 * 30,
        }),
      })),
  );

  return (
    <DescargaClient
      token={token}
      buyerEmail={sale.buyerEmail}
      buyerName={sale.buyerName ?? "Comprador"}
      eventName={sale.event.name}
      photos={photos}
      fresh={fresh}
    />
  );
}

function ExpiredOrUnpaid({ message, sub }: { message: string; sub: string }) {
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
      }}
    >
      <div
        style={{
          maxWidth: 440,
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
            width: 72,
            height: 72,
            borderRadius: "50%",
            background: "rgba(245,182,42,0.14)",
            border: "2px solid var(--warning)",
            color: "var(--warning)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 18px",
            fontSize: 36,
          }}
        >
          <i className="ti ti-alert-triangle" />
        </div>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            fontSize: 22,
            letterSpacing: "-0.02em",
            marginBottom: 8,
          }}
        >
          {message}
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>{sub}</p>
      </div>
    </main>
  );
}
