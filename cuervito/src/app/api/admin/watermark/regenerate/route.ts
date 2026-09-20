import { NextResponse, type NextRequest } from "next/server";

import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { createCFInvalidation } from "~/server/s3";
import { generatePreview } from "~/server/watermark";

/**
 * Vuelve a generar las vistas previas, de a tandas.
 *
 * El admin llama esto en un bucle desde la pantalla: cada llamada procesa una
 * tanda y devuelve el cursor de la siguiente, hasta que no queda nada. Es un
 * cursor por id y no un "cuántas faltan" porque con `force` las fotos ya
 * procesadas no salen del conjunto, y un contador de pendientes no bajaría
 * nunca.
 *
 * Sin `force` sólo toma las fotos a las que les falta alguna vista previa:
 * sirve para rellenar sin gastar CPU en lo que ya está. Con `force` toma
 * todas, que es lo que hace falta después de cambiar la marca de agua.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

const TANDA = 20;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    userId?: string;
    force?: boolean;
    cursor?: string | null;
  };
  const ownerId = body.userId;
  const force = !!body.force;

  const base = {
    fileSize: { not: null },
    deletedAt: null,
    ...(ownerId ? { ownerId } : {}),
    ...(force
      ? {}
      : { OR: [{ previewKey: null }, { previewCleanKey: null }, { previewGeneratedAt: null }] }),
  };

  // El total sólo en la primera llamada: es lo que la pantalla usa para la
  // barra, y contar 14.000 fotos en cada tanda es contar de más.
  const total = body.cursor ? null : await db.photo.count({ where: base });

  const fotos = await db.photo.findMany({
    where: { ...base, ...(body.cursor ? { id: { gt: body.cursor } } : {}) },
    orderBy: { id: "asc" },
    take: TANDA,
    select: { id: true },
  });

  /* De a una, en serie.

     Estaba con Promise.all sobre la tanda entera. El semáforo de sharp limita
     cuántas se PROCESAN a la vez, pero no cuántas ESPERAN: veinte llamadas
     arrancan sus veinte descargas de S3 y retienen veinte originales de 16 MB
     mientras hacen cola. Son 320 MB por tanda, encima de lo que ya está
     haciendo el procesador. En serie tarda lo mismo de punta a punta —el
     cuello es el semáforo igual— y no acumula nada. */
  let done = 0;
  let failed = 0;
  for (const p of fotos) {
    const r = await generatePreview(p.id);
    if (r.watermarkedKey) done++;
    else failed++;
  }

  const cursor = fotos.length === TANDA ? fotos[fotos.length - 1]!.id : null;

  // Las claves de las vistas previas no cambian al regenerarlas, y CloudFront
  // las guarda un día: sin esto, la tienda seguiría mostrando la marca vieja
  // hasta mañana. Una sola invalidación al terminar, con comodín, cuenta
  // como un camino para la cuota de CloudFront.
  if (cursor === null && force) {
    void createCFInvalidation(["/*"]);
  }

  return NextResponse.json({ processed: fotos.length, done, failed, cursor, total });
}
