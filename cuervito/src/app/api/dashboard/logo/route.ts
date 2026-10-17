import { randomBytes } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { resolveMediaUrl } from "~/server/media";
import { CACHE_MOSTRAR, deleteS3Objects, putS3Object, storefrontLogoKey } from "~/server/s3";

const MAX_BYTES = 3 * 1024 * 1024; // 3 MB
const EXTENSION: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/**
 * Subir (o cambiar) el logo de la tienda.
 *
 * Cada subida va a una clave NUEVA de S3. Antes se pisaba siempre la misma, y
 * como la URL no cambiaba, ni CloudFront ni el navegador volvían a pedirla: el
 * fotógrafo subía otro logo y seguía viendo el de antes, hasta en su propio
 * panel. La invalidación del CDN no alcanzaba, porque la caché que molestaba
 * era la del navegador. Con la clave versionada no hay nada que invalidar.
 *
 * El orden importa: primero el archivo nuevo, después la base, y recién al
 * final se borra el viejo. Si algo falla a mitad de camino, lo peor que queda
 * es un archivo huérfano, nunca un `logoKey` que apunta a nada.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("logo");
  if (!(file instanceof File))
    return NextResponse.json({ error: "Archivo faltante" }, { status: 400 });
  const ext = EXTENSION[file.type];
  if (!ext) return NextResponse.json({ error: "Solo PNG, JPG o WebP." }, { status: 400 });
  if (file.size > MAX_BYTES)
    return NextResponse.json({ error: "Máximo 3 MB." }, { status: 413 });

  const userId = session.user.id;
  const anterior = await db.user.findUnique({ where: { id: userId }, select: { logoKey: true } });

  const key = storefrontLogoKey(userId, randomBytes(4).toString("hex"), ext);
  await putS3Object(key, Buffer.from(await file.arrayBuffer()), file.type, CACHE_MOSTRAR);
  await db.user.update({ where: { id: userId }, data: { logoKey: key } });

  if (anterior?.logoKey && anterior.logoKey !== key) {
    await deleteS3Objects([anterior.logoKey]).catch(() => undefined);
  }

  // La URL resuelta y no sólo la clave: así el panel la muestra sin tener que
  // saber cómo se arma una URL de CloudFront.
  return NextResponse.json({ ok: true, key, url: await resolveMediaUrl(key) });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;
  const actual = await db.user.findUnique({ where: { id: userId }, select: { logoKey: true } });

  await db.user.update({ where: { id: userId }, data: { logoKey: null } });
  if (actual?.logoKey) await deleteS3Objects([actual.logoKey]).catch(() => undefined);

  return NextResponse.json({ ok: true });
}
