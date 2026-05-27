import "server-only";

import { isCuervitoKey } from "~/server/s3";
import { resolveMediaUrl } from "~/server/media";

export async function resolveAvatarUrl(
  image: string | null | undefined,
): Promise<string | null> {
  if (!image) return null;
  if (image.startsWith("http://") || image.startsWith("https://")) return image;
  if (isCuervitoKey(image)) {
    return resolveMediaUrl(image, { expiresIn: 60 * 60 * 6 }).catch(() => null);
  }
  return null;
}
