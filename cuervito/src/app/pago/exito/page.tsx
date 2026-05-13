import { redirect } from "next/navigation";

/**
 * Mercado Pago redirects buyers here when the payment is approved (configured
 * via back_urls.success in the preference). We immediately forward to
 * /pago/procesando which polls the webhook state and runs the unified
 * confirmation animation. MP doesn't always have the webhook done by the
 * time the user returns, so the procesando page is what we want them to see.
 */
export default async function PagoExitoPage(props: {
  searchParams: Promise<{ sale?: string; external_reference?: string }>;
}) {
  const sp = await props.searchParams;
  const saleId = sp.sale ?? sp.external_reference;
  if (!saleId) redirect("/");
  redirect(`/pago/procesando?sale=${encodeURIComponent(saleId)}`);
}
