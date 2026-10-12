import "server-only";

import sharp from "sharp";

import { db } from "~/server/db";
import { avatarKey, createCFInvalidation, isCuervitoKey, putS3Object } from "~/server/s3";

/**
 * La foto de perfil de Google, copiada a nuestro S3.
 *
 * Al entrar con Google, NextAuth guardaba en User.image el link de la foto
 * (lh3.googleusercontent.com). Ese link es temporal: al tiempo devuelve 400,
 * y la foto desaparecía de la tienda y del panel. Veintitrés de los veintinueve
 * fotógrafos con foto la tenían así cuando se encontró.
 *
 * Ahora, en cada inicio de sesión con Google, si la cuenta todavía no tiene
 * una foto nuestra, se baja la de Google mientras el link está fresco y se
 * sube a la misma clave que usa la subida a mano (avatarKey). Es lo mismo que
 * hace /api/profile/avatar con un archivo: 256×256, JPEG.
 *
 * Se llama desde el evento signIn de NextAuth, que no espera el resultado:
 * si falla, el inicio de sesión sigue y se vuelve a intentar la próxima vez.
 */
export async function copiarAvatarDeGoogle(userId: string, fotoGoogle: string): Promise<void> {
  const actual = await db.user.findUnique({ where: { id: userId }, select: { image: true } });
  if (!actual || (actual.image && isCuervitoKey(actual.image))) return;

  // Google acepta el tamaño en el sufijo: =s96-c es lo que manda el perfil,
  // =s512-c es lo que necesitamos para que no salga pixelada.
  const url = fotoGoogle.replace(/=s\d+-c$/, "=s512-c");
  const r = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!r.ok) throw new Error(`Google devolvió ${r.status} para la foto de perfil`);
  const procesada = await sharp(Buffer.from(await r.arrayBuffer()))
    .rotate()
    .resize(256, 256, { fit: "cover", position: "centre" })
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();

  const key = avatarKey(userId, "jpg");
  await putS3Object(key, procesada, "image/jpeg");
  await db.user.update({ where: { id: userId }, data: { image: key } });
  void createCFInvalidation([`/${key}`]);
}
