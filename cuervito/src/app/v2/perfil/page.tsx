import { Pendiente } from "../_components/pendiente";

export const dynamic = "force-dynamic";

export default function V2Perfil() {
  return (
    <Pendiente
      activo="perfil"
      titulo="Perfil"
      bajada="Lo que el atleta ve de vos, y los datos de tu cuenta."
      actual="/dashboard/perfil"
    />
  );
}
