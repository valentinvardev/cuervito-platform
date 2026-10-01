import { redirect } from "next/navigation";

/**
 * El perfil ya no es una página: es un diálogo que se abre desde la tarjeta
 * del riel. Esta ruta queda para lo que todavía apunte acá —un marcador, un
 * link viejo— y lleva al panel con el diálogo abierto.
 */
export default function V2Perfil() {
  redirect("/dashboard?perfil=1");
}
