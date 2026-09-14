import { estadoCorreos } from "~/server/correos/enviar";

import { Correos } from "./_cliente";

export const dynamic = "force-dynamic";

/**
 * Las campañas de mail: qué está prendido, a quiénes les tocaría, qué salió.
 *
 * El layout ya garantizó el rol. Acá sólo se lee el estado y se dibuja.
 */
export default async function AdminCorreosPage() {
  const estado = await estadoCorreos();
  return <Correos estado={estado} />;
}
