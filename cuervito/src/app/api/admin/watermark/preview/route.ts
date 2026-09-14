import { NextResponse } from "next/server";
import sharp from "sharp";
import { z } from "zod";

import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { armarUnidad, capaParaFoto, esquemaConfig } from "~/server/marca-agua";
import { getS3ObjectBytes } from "~/server/s3";
import { loadPlatformWatermark } from "~/server/watermark";

/**
 * La marca de agua, probada sobre una foto real, sin guardar nada.
 *
 * El admin mueve un control, esto devuelve la foto con la marca puesta tal
 * cual saldría. Usa la vista previa SIN marca que ya existe de cada foto —la
 * que ve el fotógrafo en su panel— y no el original: es la misma imagen
 * sobre la que el procesador estampa, así que lo que se ve es lo que va a
 * salir, y pesa diez veces menos.
 *
 * `modo: "unidad"` devuelve la unidad sola, en PNG con transparencia, para
 * la caja de "así queda una" del editor.
 */

export const runtime = "nodejs";
export const maxDuration = 30;

// Ancho de la vista previa. Menos que los 2400 del preview real: es para
// mirar en una pantalla, no para vender, y así tarda menos de medio segundo.
const ANCHO = 1400;

const esquema = z.object({
  modo: z.enum(["foto", "unidad"]).default("foto"),
  photoId: z.string().min(1).optional(),
  cfg: esquemaConfig,
});

export async function POST(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const parsed = esquema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const { modo, photoId, cfg } = parsed.data;

  // La imagen de la unidad: el PNG subido si la config lo pide y existe, si
  // no el logo de encontrate (null → lo pone armarUnidad).
  const imagen = cfg.fuente === "subida" ? await loadPlatformWatermark() : null;

  if (modo === "unidad") {
    const u = await armarUnidad({ imagen, cfg, ancho: 480, conTexto: true });
    return new NextResponse(new Uint8Array(u.png), {
      headers: {
        "content-type": "image/png",
        "cache-control": "no-store",
        "x-unidad": `${u.ancho}x${u.alto}`,
      },
    });
  }

  if (!photoId) return NextResponse.json({ error: "Falta la foto." }, { status: 400 });
  const foto = await db.photo.findFirst({
    where: { id: photoId, deletedAt: null, previewCleanKey: { not: null } },
    select: { previewCleanKey: true },
  });
  if (!foto?.previewCleanKey) {
    return NextResponse.json({ error: "No encontramos esa foto." }, { status: 404 });
  }

  const limpia = Buffer.from(await getS3ObjectBytes(foto.previewCleanKey));
  const base = await sharp(limpia, { limitInputPixels: 60_000_000 })
    .resize({ width: ANCHO, withoutEnlargement: true })
    .toBuffer();
  const meta = await sharp(base).metadata();
  const capa = await capaParaFoto({
    anchoFoto: meta.width ?? ANCHO,
    altoFoto: meta.height ?? Math.round(ANCHO * 0.66),
    imagen,
    cfg,
    conTexto: true,
  });
  const jpeg = await sharp(base).composite([capa]).jpeg({ quality: 82 }).toBuffer();

  return new NextResponse(new Uint8Array(jpeg), {
    headers: {
      "content-type": "image/jpeg",
      "content-length": String(jpeg.length),
      "cache-control": "no-store",
    },
  });
}
