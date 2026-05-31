import { db } from "~/server/db";
import { resolveMediaUrl } from "~/server/media";

import { WatermarkAdminUI } from "./watermark-ui";

export default async function AdminWatermarkPage() {
  const [setting, photosNeedingPreview, totalPhotos, photographers] =
    await Promise.all([
      db.setting.findUnique({ where: { key: "watermark" } }),
      db.photo.count({
        where: {
          fileSize: { not: null },
          deletedAt: null,
          OR: [
            { previewKey: null },
            { previewCleanKey: null },
            { previewGeneratedAt: null },
          ],
        },
      }),
      db.photo.count({ where: { fileSize: { not: null }, deletedAt: null } }),
      db.user.findMany({
        where: { role: "PHOTOGRAPHER", status: "ACTIVE" },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          email: true,
          watermarkKey: true,
          _count: { select: { photosOwned: { where: { fileSize: { not: null }, deletedAt: null } } } },
        },
      }),
    ]);

  const watermarkUrl = setting?.value
    ? await resolveMediaUrl(setting.value)
    : null;

  return (
    <main className="wrap-narrower">
      <div className="head">
        <h1>Watermark</h1>
        <div className="sub">
          Gestioná el watermark global y los watermarks por fotógrafo.
        </div>
      </div>

      <WatermarkAdminUI
        currentUrl={watermarkUrl}
        totalPhotos={totalPhotos}
        photosNeedingPreview={photosNeedingPreview}
        photographers={photographers.map((p) => ({
          id: p.id,
          name: p.name ?? p.email ?? p.id,
          hasCustomWatermark: !!p.watermarkKey,
          photoCount: p._count.photosOwned,
        }))}
      />
    </main>
  );
}
