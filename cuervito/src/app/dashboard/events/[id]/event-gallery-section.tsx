"use client";

import { InviteCollaboratorButton } from "./invite-collaborator-button";
import { PhotoGrid } from "./photo-grid";
import { PhotoUploader } from "./photo-uploader";

type Photo = {
  id: string;
  filename: string;
  fileSize: number | null;
  previewUrl: string;
  bibNumbers: string | null;
  width: number | null;
  height: number | null;
};

export function EventGallerySection({
  eventId,
  pricePerPhoto,
  photosCount,
  photos,
  maxPhotoBytes,
}: {
  eventId: string;
  pricePerPhoto: number;
  photosCount: number;
  photos: Photo[];
  maxPhotoBytes: number;
}) {
  return (
    <>
      <div className="gallery-head">
        <h2>Galería</h2>
        <div className="gallery-head-right">
          <span className="meta">
            {photosCount > 0
              ? `${photosCount.toLocaleString("es-AR")} fotos`
              : "Aún sin fotos"}
          </span>
          <InviteCollaboratorButton
            eventId={eventId}
            pricePerPhoto={pricePerPhoto}
            label="Colaborador"
          />
        </div>
      </div>

      <PhotoUploader eventId={eventId} maxPhotoBytes={maxPhotoBytes} />

      {photos.length > 0 && <PhotoGrid eventId={eventId} photos={photos} />}
    </>
  );
}
