import { db } from "~/server/db";
import { getPresignedDownloadUrl } from "~/server/s3";

import { WatermarkAdminUI } from "./watermark-ui";

export default async function AdminWatermarkPage() {
  const setting = await db.setting.findUnique({ where: { key: "watermark" } });
  const photosNeedingPreview = await db.photo.count({
    where: {
      fileSize: { not: null },
      deletedAt: null,
      OR: [{ previewKey: null }, { previewGeneratedAt: null }],
    },
  });
  const totalPhotos = await db.photo.count({
    where: { fileSize: { not: null }, deletedAt: null },
  });

  const watermarkUrl = setting?.value
    ? await getPresignedDownloadUrl(setting.value, { expiresIn: 60 * 30 })
    : null;

  return (
    <main className="wrap-narrower">
      <div className="head">
        <h1>Watermark global</h1>
        <div className="sub">
          Este PNG se aplica a todas las fotos subidas a la plataforma como preview.
        </div>
      </div>

      <WatermarkAdminUI
        currentUrl={watermarkUrl}
        totalPhotos={totalPhotos}
        photosNeedingPreview={photosNeedingPreview}
      />
    </main>
  );
}
