import { NextResponse } from "next/server";
import sharp from "sharp";

import { fotoDeLaHistoria, verificar } from "~/server/correos/compartir";
import { db } from "~/server/db";
import { datosDePieza } from "~/server/historias/pieza";
import { renderHistoria } from "~/server/historias/render";
import { getS3ObjectBytes } from "~/server/s3";

/**
 * La vista previa de la historia en el mail de "¿ya lo compartiste?".
 *
 * Es la misma pieza que arma el estudio —misma foto, misma plantilla, mismos
 * datos— pero a la mitad de tamaño: en el mail se ve a 200 px, y la foto va
 * sin marca de agua, así que no tiene por qué viajar entera. Sin sesión,
 * porque el mail se abre en cualquier lado; la firma del link es lo que
 * impide pedir la historia de un evento ajeno.
 *
 * Se arma cuando se pide y no al mandar el mail: guardarla sería una tabla y
 * una limpieza para una imagen que se mira una vez. Los clientes de correo la
 * piden una o dos veces (Gmail la pasa por su proxy y la guarda), y para eso
 * alcanza con una copia en memoria y que la CDN la cachee.
 */

export const runtime = "nodejs";
export const maxDuration = 30;

const ANCHO = 540;
const VIDA_MS = 60 * 60_000;
const TOPE = 30;

declare global {
  var __cuervito_historias_correo__: Map<string, { jpeg: Buffer; vence: number }> | undefined;
}
const copias = (globalThis.__cuervito_historias_correo__ ??= new Map<string, { jpeg: Buffer; vence: number }>());

function noEsta(): Response {
  return new NextResponse("No encontrada", { status: 404, headers: { "cache-control": "no-store" } });
}

export async function GET(_req: Request, ctx: { params: Promise<{ evento: string; archivo: string }> }) {
  const { evento, archivo } = await ctx.params;
  if (!verificar("historia", evento, archivo.replace(/\.jpg$/, ""))) return noEsta();

  const guardada = copias.get(evento);
  let jpeg = guardada && guardada.vence > Date.now() ? guardada.jpeg : null;

  if (!jpeg) {
    const [ev, foto] = await Promise.all([
      db.event.findUnique({
        where: { id: evento },
        select: {
          name: true,
          eventDate: true,
          location: true,
          discipline: true,
          pricePerPhoto: true,
          status: true,
          owner: { select: { slug: true, storefrontBrandColor: true, logoKey: true } },
          // La misma cuenta que el estudio, para que la pieza diga lo mismo.
          _count: { select: { photos: { where: { fileSize: { not: null } } } } },
        },
      }),
      fotoDeLaHistoria(evento),
    ]);
    if (!ev || ev.status === "ARCHIVED" || !foto?.previewCleanKey) return noEsta();

    const bytes = await getS3ObjectBytes(foto.previewCleanKey);
    const { jpeg: entera } = await renderHistoria({
      foto: Buffer.from(bytes),
      plantilla: "cubierta",
      formato: "historia",
      datos: await datosDePieza({ ...ev, fotos: ev._count.photos }, ev.owner),
    });
    jpeg = await sharp(entera).resize({ width: ANCHO }).jpeg({ quality: 80, mozjpeg: true }).toBuffer();

    const masVieja = copias.keys().next().value;
    if (copias.size >= TOPE && masVieja) copias.delete(masVieja);
    copias.set(evento, { jpeg, vence: Date.now() + VIDA_MS });
  }

  return new NextResponse(new Uint8Array(jpeg), {
    headers: {
      "content-type": "image/jpeg",
      "content-length": String(jpeg.length),
      "cache-control": "public, max-age=86400",
    },
  });
}
