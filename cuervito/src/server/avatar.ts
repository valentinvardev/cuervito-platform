import "server-only";

import { getPresignedDownloadUrl, isCuervitoKey } from "~/server/s3";

export async function resolveAvatarUrl(
  image: string | null | undefined,
): Promise<string | null> {
  if (!image) return null;
  if (image.startsWith("http://") || image.startsWith("https://")) return image;
  if (isCuervitoKey(image)) {
    try {
      return await getPresignedDownloadUrl(image, { expiresIn: 60 * 60 * 6 });
    } catch {
      return null;
    }
  }
  return null;
}
