"use client";

import { PhotoGrid } from "./photo-grid";
import { PhotoUploader } from "./photo-uploader";

type Photo = {
  id: string;
  filename: string;
  fileSize: number | null;
  previewUrl: string;
  bibNumbers: string | null;
};

export function EventGallerySection({
  eventId,
  photosCount,
  photos,
  maxPhotoBytes,
}: {
  eventId: string;
  photosCount: number;
  photos: Photo[];
  maxPhotoBytes: number;
}) {
  return (
    <>
      <div className="gallery-head">
        <h2>Galería</h2>
        <span className="meta">
          {photosCount > 0
            ? `${photosCount.toLocaleString("es-AR")} fotos`
            : "Aún sin fotos"}
        </span>
      </div>

      <PhotoUploader eventId={eventId} maxPhotoBytes={maxPhotoBytes} />

      {photos.length > 0 && <PhotoGrid eventId={eventId} photos={photos} />}
    </>
  );
}
