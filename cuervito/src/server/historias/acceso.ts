import "server-only";

import { unstable_cache } from "next/cache";

import { db } from "~/server/db";

/**
 * Quién ve el estudio de historias.
 *
 * Dos llaves, y las dos hacen falta por razones distintas:
 *
 * · El rol ADMIN es el piso: es lo que nos deja probar entre nosotros sin
 *   tocar nada. Ya es el mecanismo que gobierna /admin, así que no inventa un
 *   permiso nuevo que después haya que mantener en dos lados.
 *
 * · La lista de ids en Setting es lo que va a hacer falta la primera vez que
 *   queramos abrírselo a un fotógrafo de verdad. Sin eso, sumar un probador
 *   significa promoverlo a ADMIN —darle el panel de administración entero por
 *   un permiso de beta— o deployar. Las dos están mal.
 *
 * El valor es una lista de ids separados por coma. Es a mano y es feo, y está
 * bien que lo sea: si la beta crece hasta necesitar una pantalla para
 * administrar esto, ya no es una beta y merece una tabla.
 */
const CLAVE = "historias_beta_ids";

async function leerBeta(): Promise<string[]> {
  const fila = await db.setting.findUnique({
    where: { key: CLAVE },
    select: { value: true },
  });
  if (!fila?.value) return [];
  return fila.value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const getBeta = unstable_cache(leerBeta, ["setting", CLAVE], {
  revalidate: 30,
  tags: [`setting:${CLAVE}`],
});

export async function puedeUsarHistorias(
  usuario: { id: string; role?: string | null } | null | undefined,
): Promise<boolean> {
  if (!usuario?.id) return false;
  if (usuario.role === "ADMIN") return true;
  return (await getBeta()).includes(usuario.id);
}
