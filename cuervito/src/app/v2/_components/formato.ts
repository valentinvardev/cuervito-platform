/**
 * Formateo, sin nada del servidor.
 *
 * Está separado de sesion.ts porque ese importa la base y auth: alcanza con que
 * un componente cliente quiera `pesos()` para arrastrar el cliente de Prisma al
 * paquete del navegador. Acá no hay más que funciones puras, así que lo puede
 * importar cualquiera de los dos lados.
 */
export function iniciales(nombre: string) {
  return (
    nombre
      .split(" ")
      .map((p) => p[0]?.toUpperCase() ?? "")
      .filter(Boolean)
      .slice(0, 2)
      .join("") || "?"
  );
}

/** Recibe CENTAVOS. Los precios de evento, en cambio, están en pesos. */
export function pesos(centavos: number) {
  return "$" + Math.round(centavos / 100).toLocaleString("es-AR");
}

export function hace(d: Date) {
  const min = Math.round((Date.now() - d.getTime()) / 60000);
  if (min < 60) return `hace ${min} min`;
  if (min < 1440) return `hace ${Math.round(min / 60)} h`;
  return `hace ${Math.round(min / 1440)} d`;
}

export function slugDeNombre(nombre: string) {
  return (
    nombre
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "fotografo"
  );
}
