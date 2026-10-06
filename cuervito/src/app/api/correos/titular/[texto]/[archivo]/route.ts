import { NextResponse } from "next/server";

import { dibujarTitular, textoDeTitular, verificarTitular } from "~/server/correos/titulares";

/**
 * El titular de un mail como imagen, con la tipografía de la marca. El porqué
 * está en server/correos/titulares.ts. Sin sesión —el mail se abre donde sea—
 * y sólo con un texto que el servidor firmó al armar el mail.
 */

export const runtime = "nodejs";

const VIDA_MS = 6 * 60 * 60_000;
const TOPE = 200;

declare global {
  var __cuervito_titulares_correo__: Map<string, { png: Buffer; vence: number }> | undefined;
}
const copias = (globalThis.__cuervito_titulares_correo__ ??= new Map<string, { png: Buffer; vence: number }>());

export async function GET(_req: Request, ctx: { params: Promise<{ texto: string; archivo: string }> }) {
  const { texto: codificado, archivo } = await ctx.params;
  const texto = textoDeTitular(codificado);
  if (!texto || !verificarTitular(texto, archivo.replace(/\.png$/, ""))) {
    return new NextResponse("No encontrado", { status: 404, headers: { "cache-control": "no-store" } });
  }

  const guardada = copias.get(texto);
  let png = guardada && guardada.vence > Date.now() ? guardada.png : null;
  if (!png) {
    png = await dibujarTitular(texto);
    const masVieja = copias.keys().next().value;
    if (copias.size >= TOPE && masVieja) copias.delete(masVieja);
    copias.set(texto, { png, vence: Date.now() + VIDA_MS });
  }

  return new NextResponse(new Uint8Array(png), {
    headers: {
      "content-type": "image/png",
      "content-length": String(png.length),
      // El mismo texto da siempre la misma imagen: se puede guardar mucho.
      "cache-control": "public, max-age=2592000, immutable",
    },
  });
}
