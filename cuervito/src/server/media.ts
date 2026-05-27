import "server-only";

import { getCFUrl, getPresignedDownloadUrl } from "~/server/s3";

/**
 * Resolves an S3 key to a URL for display (previews, covers, avatars, logos).
 * Uses CloudFront when configured — stable URL, no signing, edge-cached.
 * Falls back to a presigned S3 URL in local dev without CF.
 *
 * Do NOT use for originals — those must always be presigned via getPresignedDownloadUrl.
 */
export async function resolveMediaUrl(
  key: string,
  fallbackOpts?: { expiresIn?: number },
): Promise<string> {
  return getCFUrl(key) ?? getPresignedDownloadUrl(key, fallbackOpts);
}
