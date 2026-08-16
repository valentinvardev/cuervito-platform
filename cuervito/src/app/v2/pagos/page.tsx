import { Pendiente } from "../_components/pendiente";

export const dynamic = "force-dynamic";

export default function V2Metodosdepago() {
  return (
    <Pendiente
      activo="pagos"
      titulo="Métodos de pago"
      bajada="Dónde recibís la plata de tus ventas."
      actual="/dashboard/cobros"
    />
  );
}
