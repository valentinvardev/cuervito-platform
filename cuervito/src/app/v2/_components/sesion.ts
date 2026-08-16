import { redirect } from "next/navigation";

import { auth } from "~/server/auth";
import { db } from "~/server/db";

/**
 * Control de acceso y datos del encabezado, para todas las pantallas de /v2.
 *
 * El control se repite en cada página aunque el layout ya lo haga. No es de
 * más: en el App Router el layout y la página se resuelven EN PARALELO, así
 * que confiar en la redirección del padre hace que la página igual corra con
 * sesión nula y reviente antes de que esa redirección tenga efecto.
 *
 * Que esté en una función y no copiado en cada archivo es lo que evita que
 * dentro de tres pantallas alguien se olvide del segundo control.
 */
export async function sesionV2() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/v2");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const userId = session.user.id;
  const yo = await db.user.findUnique({
    where: { id: userId },
    select: { name: true, slug: true, image: true, bio: true, mpConnectedAt: true },
  });

  const nombre = yo?.name ?? "fotógrafo";
  return {
    userId,
    yo,
    nombre,
    slug: yo?.slug ?? "tu-usuario",
    iniciales: iniciales(nombre),
  };
}

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

export function pesos(centavos: number) {
  return "$" + Math.round(centavos / 100).toLocaleString("es-AR");
}

export function hace(d: Date) {
  const min = Math.round((Date.now() - d.getTime()) / 60000);
  if (min < 60) return `hace ${min} min`;
  if (min < 1440) return `hace ${Math.round(min / 60)} h`;
  return `hace ${Math.round(min / 1440)} d`;
}


/**
 * Dirección a partir del nombre, con sufijo si está tomada.
 *
 * Es el mismo criterio del alta (src/app/(auth)/signup/actions.ts): al
 * fotógrafo no se le pide que invente un identificador, se le da uno y después
 * puede cambiarlo si quiere desde Mi página.
 *
 * Se usa sólo como red: signup ya asigna slug a todos. Existe para las cuentas
 * viejas que puedan haber quedado sin uno, que si no se caerían al guardar el
 * perfil con un error de un campo que ni siquiera se muestra.
 */
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

export async function asegurarSlug(userId: string, nombre: string, actual: string | null) {
  if (actual) return actual;
  const base = slugDeNombre(nombre);
  let slug = base;
  for (let i = 2; i < 50; i++) {
    const tomado = await db.user.findUnique({ where: { slug }, select: { id: true } });
    if (!tomado) break;
    slug = `${base}-${i}`;
  }
  await db.user.update({ where: { id: userId }, data: { slug } });
  return slug;
}
