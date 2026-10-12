import "server-only";

import { isCuervitoKey } from "~/server/s3";
import { resolveMediaUrl } from "~/server/media";

export async function resolveAvatarUrl(
  image: string | null | undefined,
): Promise<string | null> {
  if (!image) return null;
  // Los links de Google (lh3.googleusercontent.com) vencen y devuelven 400:
  // una foto rota es peor que las iniciales. En el próximo inicio de sesión
  // se copia a S3 (ver avatar-google.ts) y de ahí en más es una clave nuestra.
  if (/^https?:\/\/[^/]*googleusercontent\.com\//.test(image)) return null;
  if (image.startsWith("http://") || image.startsWith("https://")) return image;
  if (isCuervitoKey(image)) {
    return resolveMediaUrl(image, { expiresIn: 60 * 60 * 6 }).catch(() => null);
  }
  return null;
}
