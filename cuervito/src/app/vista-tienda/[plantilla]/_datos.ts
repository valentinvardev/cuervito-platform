import "server-only";

import { cache } from "react";

import { auth } from "~/server/auth";
import { db } from "~/server/db";

/**
 * La dirección del que mira, una vez por request: la piden el layout (para
 * las variables de la plantilla) y la página. Sin sesión no hay previa: la
 * página se arma con los datos del dueño, y el dueño es el único que la ve.
 */
export const direccionDelQueMira = cache(async (): Promise<string | null> => {
  const sesion = await auth();
  if (!sesion?.user?.id) return null;
  const yo = await db.user.findUnique({
    where: { id: sesion.user.id },
    select: { slug: true },
  });
  return yo?.slug ?? null;
});
