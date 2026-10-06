import { NextResponse } from "next/server";
import sharp from "sharp";

import { esForma, FORMAS, verificarImagen, type TipoImagen } from "~/server/correos/imagenes";
import { db } from "~/server/db";
import { getS3ObjectBytes } from "~/server/s3";

/**
 * Una imagen de un mail, recortada a la forma de su casillero y en JPEG.
 * El porqué está en server/correos/imagenes.ts.
 *
 * La foto sale de la vista previa SIN marca: los mails que la llevan son la
 * entrega —el que la recibe ya la pagó— y el aviso de venta al fotógrafo, que
 * es el dueño. A 660 px como mucho, y sólo con un link firmado que armó el
 * servidor al mandar el mail. El recorte usa la "atención" de sharp, que busca
 * la zona con más detalle: en una foto deportiva, casi siempre el atleta.
 */

export const runtime = "nodejs";
export const maxDuration = 30;

const VIDA_MS = 60 * 60_000;
const TOPE = 60;

declare global {
  var __cuervito_imagenes_correo__: Map<string, { jpeg: Buffer; vence: number }> | undefined;
}
const copias = (globalThis.__cuervito_imagenes_correo__ ??= new Map<string, { jpeg: Buffer; vence: number }>());

function noEsta(): Response {
  return new NextResponse("No encontrada", { status: 404, headers: { "cache-control": "no-store" } });
}

async function claveDe(tipo: TipoImagen, id: string): Promise<string | null> {
  if (tipo === "foto") {
    const f = await db.photo.findUnique({
      where: { id },
      select: { previewCleanKey: true, previewKey: true, deletedAt: true },
    });
    // Una foto borrada no sale más, ni en un mail viejo.
    if (!f || f.deletedAt) return null;
    return f.previewCleanKey ?? f.previewKey;
  }
  const e = await db.event.findUnique({ where: { id }, select: { coverUrl: true } });
  // Las portadas de antes del bucket eran URLs externas: ésas no pasan por acá.
  if (!e?.coverUrl || e.coverUrl.startsWith("http")) return null;
  return e.coverUrl;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ tipo: string; id: string; forma: string; archivo: string }> },
) {
  const { tipo, id, forma, archivo } = await ctx.params;
  if ((tipo !== "foto" && tipo !== "portada") || !esForma(forma)) return noEsta();
  if (!verificarImagen(tipo, id, forma, archivo.replace(/\.jpg$/, ""))) return noEsta();

  const llave = `${tipo}:${id}:${forma}`;
  const guardada = copias.get(llave);
  let jpeg = guardada && guardada.vence > Date.now() ? guardada.jpeg : null;

  if (!jpeg) {
    const clave = await claveDe(tipo, id);
    if (!clave) return noEsta();
    const [ancho, alto] = FORMAS[forma];
    const bytes = await getS3ObjectBytes(clave);
    jpeg = await sharp(Buffer.from(bytes))
      .rotate()
      .resize(ancho, alto, { fit: "cover", position: sharp.strategy.attention })
      .jpeg({ quality: 78, mozjpeg: true })
      .toBuffer();
    const masVieja = copias.keys().next().value;
    if (copias.size >= TOPE && masVieja) copias.delete(masVieja);
    copias.set(llave, { jpeg, vence: Date.now() + VIDA_MS });
  }

  return new NextResponse(new Uint8Array(jpeg), {
    headers: {
      "content-type": "image/jpeg",
      "content-length": String(jpeg.length),
      "cache-control": "public, max-age=86400",
    },
  });
}
