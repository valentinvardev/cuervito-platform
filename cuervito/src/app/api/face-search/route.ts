import { NextResponse, type NextRequest } from "next/server";
import { SearchFacesByImageCommand } from "@aws-sdk/client-rekognition";

import { db } from "~/server/db";
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

    if (matchedPhotoIds.length === 0) {
      return NextResponse.json({ photoIds: [] });
    }

    // Filter to photos that actually belong to this event (defensive — extra
    // safety even though the collection itself is scoped per-event).
    const photos = await db.photo.findMany({
      where: { id: { in: matchedPhotoIds }, eventId, deletedAt: null },
      select: { id: true },
    });

    console.log(
      `[face-search] eventId=${eventId} matched=${photos.length}/${matchedPhotoIds.length}`,
    );

    return NextResponse.json({ photoIds: photos.map((p) => p.id) });
  } catch (err) {
    console.error("[face-search] error:", err);
    return NextResponse.json({ error: "Búsqueda fallida" }, { status: 500 });
  }
}
