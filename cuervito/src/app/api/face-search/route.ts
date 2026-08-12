import { NextResponse, type NextRequest } from "next/server";
import { SearchFacesByImageCommand } from "@aws-sdk/client-rekognition";

import { db } from "~/server/db";
import { VISITOR_COOKIE } from "~/lib/visitor";
import { hasRecognitionQuota } from "~/server/quotas";
import { clientIp, hitRateLimit } from "~/server/rate-limit";
import {
  billedCall,
  rekCollectionForEvent,
  rekognition,
} from "~/server/rekognition";

/**
 * Este endpoint es público a propósito: el comprador no tiene cuenta, así lo
 * define la arquitectura. Pero cada POST es una llamada facturable a
 * Rekognition, y el eventId viaja en el HTML de la galería, así que sin
 * límites cualquiera puede decidir cuánto gastamos.
 *
 * Los topes están calibrados muy por encima del uso real (el mes pico fueron
 * 410 búsquedas entre TODOS los eventos): frenan un script, no a una persona
 * que prueba cuatro selfies hasta que sale bien.
 */
const PER_IP = [
  { limit: 20, windowMs: 10 * 60_000 },
  { limit: 60, windowMs: 60 * 60_000 },
];
const PER_EVENT = [{ limit: 1_000, windowMs: 24 * 60 * 60_000 }];

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

    const ip = clientIp(req.headers);
    const perIp = hitRateLimit(`face-search:ip:${ip}`, PER_IP);
    if (!perIp.ok) {
      console.warn(`[face-search] rate limit ip=${ip} event=${eventId}`);
      return NextResponse.json(
        { error: "Demasiadas búsquedas seguidas. Probá de nuevo en un rato." },
        { status: 429, headers: { "retry-after": String(perIp.retryAfterSec) } },
      );
    }

    const event = await db.event.findFirst({
      where: { id: eventId, isPublished: true },
      select: { id: true, ownerId: true },
    });
    if (!event) {
      return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
    }

    // Techo por evento: si un solo evento se dispara, no se lleva puesta la
    // factura del resto.
    const perEvent = hitRateLimit(`face-search:event:${eventId}`, PER_EVENT);
    if (!perEvent.ok) {
      console.warn(`[face-search] tope diario del evento ${eventId}`);
      return NextResponse.json(
        { error: "La búsqueda por selfie no está disponible en este momento." },
        { status: 429, headers: { "retry-after": String(perEvent.retryAfterSec) } },
      );
    }

    if (!(await hasRecognitionQuota(event.ownerId, 1))) {
      console.warn(`[face-search] cuota mensual agotada owner=${event.ownerId}`);
      return NextResponse.json(
        { error: "La búsqueda por selfie no está disponible en este momento." },
        { status: 503 },
      );
    }

    const imageBytes = Buffer.from(imageBase64, "base64");
    const rekCollectionId = rekCollectionForEvent(eventId);

    let matchedPhotoIds: string[] = [];
    try {
      const result = await billedCall(
        "SearchFacesByImage",
        { ownerId: event.ownerId, eventId },
        "search",
        () =>
          rekognition.send(
            new SearchFacesByImageCommand({
              CollectionId: rekCollectionId,
              Image: { Bytes: new Uint8Array(imageBytes) },
              MaxFaces: 50,
              FaceMatchThreshold: 80,
            }),
          ),
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

    // El consumo ya lo contó billedCall, antes de la llamada: las búsquedas
    // que fallan también se facturan y antes no quedaban registradas.
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
