import "server-only";

import { revalidateTag, unstable_cache } from "next/cache";
import sharp from "sharp";

import type { TonoLogo } from "~/lib/tema-tienda";
import { getS3ObjectBytes } from "~/server/s3";

/**
 * Si el logo del fotógrafo es blanco, negro o ninguno de los dos.
 *
 * Muchos fotógrafos tienen el logo hecho para fondo oscuro —blanco sobre
 * transparente—, y en la plantilla de encontrate, que es clara, desaparece. Con
 * el tono, la tienda lo invierte cuando el fondo no le da contraste: el blanco
 * en la clara, el negro en la oscura.
 *
 * Sólo cuentan los logos con transparencia. Uno con su propio fondo (un JPG,
 * un círculo dorado) se ve igual en cualquier página y no se toca.
 */
export type { TonoLogo };

/** El logo se pisa en la misma clave al volver a subirlo, así que la caché no
 *  puede depender sólo del tiempo: la ruta de subida la invalida por etiqueta. */
export const etiquetaTonoLogo = (userId: string) => `user:${userId}:logo-tono`;

export function olvidarTonoLogo(userId: string) {
  revalidateTag(etiquetaTonoLogo(userId));
}

async function medir(key: string): Promise<TonoLogo | null> {
  // La tienda espera esto para dibujarse: si S3 tarda, mejor sin tono.
  const bytes = Buffer.from(await getS3ObjectBytes(key, { signal: AbortSignal.timeout(4000) }));
  const { data } = await sharp(bytes)
    .resize(96, 96, { fit: "inside" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let total = 0;
  let opacos = 0;
  let claros = 0;
  let oscuros = 0;
  for (let p = 0; p < data.length; p += 4) {
    total++;
    if (data[p + 3]! < 128) continue;
    opacos++;
    const l = 0.2126 * data[p]! + 0.7152 * data[p + 1]! + 0.0722 * data[p + 2]!;
    if (l > 200) claros++;
    else if (l < 60) oscuros++;
  }

  // Casi sin transparencia: el logo trae su fondo.
  if (!opacos || opacos / total > 0.9) return null;
  // Mayoría, no totalidad: un logo blanco con un detalle de color sigue
  // siendo blanco, y la inversión con giro de tono le conserva el detalle.
  if (claros / opacos > 0.6) return "claro";
  if (oscuros / opacos > 0.6) return "oscuro";
  return null;
}

export async function tonoDeLogo(userId: string, key: string | null): Promise<TonoLogo | null> {
  if (!key) return null;
  try {
    return await unstable_cache(() => medir(key), ["logo-tono", key], {
      revalidate: 60 * 60 * 24 * 7,
      tags: [etiquetaTonoLogo(userId)],
    })();
  } catch (e) {
    // Sin tono el logo se muestra como está, que es lo que pasaba antes.
    console.error("[logo-tono]", e);
    return null;
  }
}
