import { NextResponse, type NextRequest } from "next/server";
import { SearchFacesByImageCommand } from "@aws-sdk/client-rekognition";

import { db } from "~/server/db";
import { VISITOR_COOKIE } from "~/lib/visitor";
import {
  bumpRecognitionUsage,
  rekCollectionForEvent,
  rekognition,
} from "~/server/rekognition";

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, eventId } = (await req.json()) as {
      imageBase64?: string;
      eventId?: string;
    };

    if (!imageBase64 || !eventId) {
      return NextResponse.json(
        { error: "Falta imageBase64 o eventId" },
        { status: 400 },
      );
    }

    const event = await db.event.findFirst({
      where: { id: eventId, isPublished: true },
      select: { id: true, ownerId: true },
    });
    if (!event) {
      return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
    }

    const imageBytes = Buffer.from(imageBase64, "base64");
    const rekCollectionId = rekCollectionForEvent(eventId);

    let matchedPhotoIds: string[] = [];
    try {
      const result = await rekognition.send(
        new SearchFacesByImageCommand({
          CollectionId: rekCollectionId,
          Image: { Bytes: new Uint8Array(imageBytes) },
          MaxFaces: 50,
          FaceMatchThreshold: 80,
        }),
      );

      matchedPhotoIds = [
        ...new Set(
          (result.FaceMatches ?? [])
            .map((m) => m.Face?.ExternalImageId)
            .filter((id): id is string => !!id),
        ),
      ];
    } catch (err: unknown) {
      const name = (err as { name?: string }).name;
      if (name === "InvalidParameterException") {
        // Couldn't detect any face in the selfie itself
        return NextResponse.json({ photoIds: [], noFaceDetected: true });
      }
      if (name === "ResourceNotFoundException") {
        // The event has no Rekognition collection yet (no faces indexed)
        return NextResponse.json({ photoIds: [] });
      }
      if (name === "ImageTooLargeException") {
        return NextResponse.json({ photoIds: [], imageTooLarge: true });
      }
      throw err;
    }

    // Track quota (the event owner pays for the search)
    void bumpRecognitionUsage(event.ownerId, "search", 1).catch(() => undefined);

    const visitorId = req.cookies.get(VISITOR_COOKIE)?.value ?? null;

    if (matchedPhotoIds.length === 0) {
      // Se registra igual: una búsqueda sin resultados es justamente la
      // señal de que el reconocimiento no está encontrando.
      void db.faceSearchLog
        .create({ data: { eventId, visitorId, matchCount: 0, photoIds: [] } })
        .catch((err: unknown) =>
          console.error("[face-search] log failed:", err),
        );
      return NextResponse.json({ photoIds: [] });
    }

    // Filter to photos that actually belong to this event (defensive — extra
    // safety even though the collection itself is scoped per-event).
    const photos = await db.photo.findMany({
      where: { id: { in: matchedPhotoIds }, eventId, deletedAt: null },
      select: { id: true },
    });

    const shown = photos.map((p) => p.id);

    console.log(
      `[face-search] eventId=${eventId} matched=${shown.length}/${matchedPhotoIds.length}`,
    );

    // Qué fotos vio esta persona. Cruzado después contra SaleItem da la
    // conversión real del reconocimiento.
    void db.faceSearchLog
      .create({
        data: { eventId, visitorId, matchCount: shown.length, photoIds: shown },
      })
      .catch((err: unknown) => console.error("[face-search] log failed:", err));

    return NextResponse.json({ photoIds: shown });
  } catch (err) {
    console.error("[face-search] error:", err);
    return NextResponse.json({ error: "Búsqueda fallida" }, { status: 500 });
  }
}
