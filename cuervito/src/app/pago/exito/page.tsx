import { redirect } from "next/navigation";

/**
 * Mercado Pago's back_urls.success lands here. Forward to /pago/procesando
 * (which then forwards again to /descarga/[token]?fresh=1 as soon as the
 * webhook has fired). MP doesn't always have the webhook done by the time
 * the user returns, so /pago/procesando handles the wait.
 */
export default async function PagoExitoPage(props: {
  searchParams: Promise<{ sale?: string; external_reference?: string }>;
}) {
  const sp = await props.searchParams;
  const saleId = sp.sale ?? sp.external_reference;
  if (!saleId) redirect("/");
  redirect(`/pago/procesando?sale=${encodeURIComponent(saleId)}`);
}
