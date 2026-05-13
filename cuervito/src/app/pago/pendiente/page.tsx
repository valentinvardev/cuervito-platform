import { redirect } from "next/navigation";

export default async function PagoPendientePage(props: {
  searchParams: Promise<{ sale?: string; external_reference?: string }>;
}) {
  const sp = await props.searchParams;
  const saleId = sp.sale ?? sp.external_reference;
  if (!saleId) redirect("/");
  redirect(`/pago/procesando?sale=${encodeURIComponent(saleId)}`);
}
