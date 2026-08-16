import { Pendiente } from "../_components/pendiente";

export const dynamic = "force-dynamic";

export default function V2Mipagina() {
  return (
    <Pendiente
      activo="pagina"
      titulo="Mi página"
      bajada="Tu página pública, con tu marca adelante y la nuestra atrás."
      actual="/dashboard/tienda"
    />
  );
}
