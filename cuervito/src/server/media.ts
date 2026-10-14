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

/**
 * La URL de un derivado de foto (vista previa, miniatura), con su versión.
 *
 * Regenerar la marca escribe los derivados sobre las MISMAS claves, y se
 * sirven con un día de caché. La invalidación de CloudFront limpia el borde,
 * pero no el navegador de quien ya vio la tienda: la grilla, que se mira
 * todo el tiempo, seguía con la marca vieja mientras el lightbox, que pide
 * una imagen que casi nadie había abierto, ya mostraba la nueva. Con la fecha
 * de generación en la URL, regenerar es una URL nueva para todos.
 *
 * Sólo en la URL de CloudFront: a una firmada de S3 no se le puede agregar
 * nada sin romper la firma, y ésas ya son distintas en cada pedido.
 */
export async function urlDerivado(key: string, generadoEn: Date | null): Promise<string> {
  const cf = getCFUrl(key);
  if (!cf) return getPresignedDownloadUrl(key);
  return generadoEn ? `${cf}?v=${generadoEn.getTime().toString(36)}` : cf;
}
