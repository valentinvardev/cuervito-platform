import { Pendiente } from "../_components/pendiente";

export const dynamic = "force-dynamic";

export default function V2Ayuda() {
  return (
    <Pendiente
      activo="ayuda"
      titulo="Ayuda"
      bajada="Escribinos cuando quieras, o mirá si tu pregunta ya está resuelta."
      actual="/dashboard/ayuda"
    />
  );
}
