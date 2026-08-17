import { notFound } from "next/navigation";

import { db } from "~/server/db";
import { getPresignedDownloadUrl } from "~/server/s3";
import { resolveAvatarUrl } from "~/server/avatar";
import { resolveMediaUrl } from "~/server/media";

import { buildTemplateStyle, getTemplate } from "~/lib/storefront-templates";

import { DescargaClient } from "./descarga-client";
import { Entrega } from "./encontrate/entrega";

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
      // La plantilla del vendedor decide qué entrega se dibuja, igual que en
      // la tienda: el comprador acaba de estar en su página y tiene que
      // reconocer el mismo lugar diez segundos después.
      seller: {
        select: {
          storefrontTemplate: true,
          storefrontBrandColor: true,
          name: true,
          slug: true,
          image: true,
        },
      },
      event: { select: { name: true, slug: true } },
      items: {
        select: {
          photo: {
            select: {
              id: true,
              filename: true,
              storageKey: true,
              previewKey: true,
              previewCleanKey: true,
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
        // La LIMPIA primero. previewKey es la que lleva marca de agua, que es
        // para la vitrina; acá el comprador ya pagó y estaba viendo su compra
        // marcada como si todavía tuviera que decidir.
        previewUrl: p.previewCleanKey
          ? await resolveMediaUrl(p.previewCleanKey)
          : p.previewKey
            ? await resolveMediaUrl(p.previewKey)
            : await getPresignedDownloadUrl(p.storageKey, { expiresIn: 60 * 30 }),
      })),
  );

  if (getTemplate(sale.seller.storefrontTemplate).layout === "encontrate") {
    return (
      <div
        style={buildTemplateStyle(
          sale.seller.storefrontTemplate,
          sale.seller.storefrontBrandColor,
        )}
      >
        <Entrega
          token={token}
          comprador={sale.buyerName ?? "Comprador"}
          evento={sale.event.name}
          fotografo={{
            nombre: sale.seller.name ?? "El fotógrafo",
            slug: sale.seller.slug ?? "",
            avatar: await resolveAvatarUrl(sale.seller.image),
            iniciales:
              (sale.seller.name ?? "?")
                .split(" ")
                .map((p) => p[0]?.toUpperCase() ?? "")
                .filter(Boolean)
                .slice(0, 2)
                .join("") || "?",
          }}
          fotos={photos}
          recienPagado={fresh}
        />
      </div>
    );
  }

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
