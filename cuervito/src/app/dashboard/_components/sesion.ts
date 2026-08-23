import { redirect } from "next/navigation";

import { auth } from "~/server/auth";
import { db } from "~/server/db";

import { iniciales, slugDeNombre } from "./formato";

/**
 * Control de acceso y datos del encabezado, para todas las pantallas del panel.
 *
 * El control se repite en cada página aunque el layout ya lo haga. No es de
 * más: en el App Router el layout y la página se resuelven EN PARALELO, así
 * que confiar en la redirección del padre hace que la página igual corra con
 * sesión nula y reviente antes de que esa redirección tenga efecto.
 *
 * Que esté en una función y no copiado en cada archivo es lo que evita que
 * dentro de tres pantallas alguien se olvide del segundo control.
 */
export async function sesionPanel() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/dashboard");

  // Ya NO hay control de admin. Mientras esto vivía en /v2 era una vista previa
  // y el candado mandaba al resto al panel viejo; ahora ESTE es el panel, así
  // que ese redirect apuntaría a sí mismo y dejaría a cualquiera que no sea
  // admin dando vueltas en un bucle.

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

/* Las funciones de formateo viven en formato.ts, que no importa nada del
   servidor: así las puede usar también un componente cliente sin arrastrar
   Prisma al navegador. Se reexportan para no tocar lo que ya las importa
   desde acá. */
export { hace, iniciales, pesos, slugDeNombre } from "./formato";

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
export async function asegurarSlug(userId: string, nombre: string, actual: string | null) {
  const base = slugDeNombre(nombre);
  if (actual) return actual;
  let slug = base;
  for (let i = 2; i < 50; i++) {
    const tomado = await db.user.findUnique({ where: { slug }, select: { id: true } });
    if (!tomado) break;
    slug = `${base}-${i}`;
  }
  await db.user.update({ where: { id: userId }, data: { slug } });
  return slug;
}
