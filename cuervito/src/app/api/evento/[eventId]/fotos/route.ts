import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { db } from "~/server/db";
import { resolveMediaUrl } from "~/server/media";

/**
 * Las fotos de un evento, de a tandas.
 *
 * Existe porque la página mandaba las 2.162 fotos del evento para mostrar 24.
 * Medido: Postgres resuelve esa consulta en 3 milisegundos, pero mover las
 * 783 KB de resultado desde Supabase hasta el VPS tardaba TREINTA SEGUNDOS. El
 * cuello no está en la base ni en el índice: está en la cantidad de datos que
 * cruzan la red en cada visita. La única salida es no traerlos.
 *
 * Contesta tres preguntas distintas con la misma forma de respuesta, porque las
 * tres terminan siendo "dame estas fotos":
 *
 *   ?cursor=…   la tanda siguiente
 *   ?dorsal=…   las que tienen ese número
 *   ?ids=…      estas fotos puntuales — es lo que necesita la selfie, que ya
 *               resuelve en el servidor y vuelve con una lista de ids
 *
 * Es público y sin sesión: es la vitrina del fotógrafo. Lo único que se
 * verifica es que el evento esté publicado, igual que la página.
 */

export const runtime = "nodejs";

/** Cuántas fotos por tanda. */
const TANDA = 60;
/** Tope de ids por pedido, para que nadie use esto como descarga masiva. */
const MAX_IDS = 200;

const esquema = z.object({
  cursor: z.string().min(1).optional(),
  dorsal: z.string().trim().max(12).optional(),
  ids: z.string().max(MAX_IDS * 30).optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await params;
  const parsed = esquema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const { cursor, dorsal, ids } = parsed.data;

  const evento = await db.event.findFirst({
    where: { id: eventId, isPublished: true, NOT: { status: "ARCHIVED" } },
    select: { id: true },
  });
  if (!evento) {
    return NextResponse.json({ error: "Evento no disponible." }, { status: 404 });
  }

  // Las mismas condiciones que la página. previewKey obligatorio: sin él, caer
  // al original sería publicar la foto sin marca de agua.
  const base = {
    eventId,
    fileSize: { not: null },
    deletedAt: null,
    previewKey: { not: null },
  } as const;

  /* El dorsal se filtra ACÁ y no en el navegador.

     bibNumbers guarda los números separados por coma y sin espacios —"075,068"—
     así que "empieza con" sobre cualquiera de ellos son dos condiciones: que
     arranque el texto entero, o que arranque justo después de una coma.

     Se mantiene la búsqueda por PREFIJO, que es lo que hacía el navegador: el
     que escribe 12 ve la 12, la 120 y la 125. Parecía que eso obligaba a una
     tabla aparte de dorsales, porque un LIKE no usa índice; medido, no hace
     falta: el índice de eventId ya acota el scan a las fotos de este evento y
     filtrar dos mil quinientas filas le lleva microsegundos. Lo caro nunca fue
     Postgres. */
  const buscado = dorsal?.trim();
  const porDorsal = buscado
    ? {
        OR: [
          { bibNumbers: { startsWith: buscado } },
          { bibNumbers: { contains: `,${buscado}` } },
        ],
      }
    : {};

  const listaIds = ids
    ? ids.split(",").map((s) => s.trim()).filter(Boolean).slice(0, MAX_IDS)
    : null;

  const filas = await db.photo.findMany({
    where: {
      ...base,
      ...porDorsal,
      ...(listaIds ? { id: { in: listaIds } } : {}),
    },
    // El desempate por id no es adorno: en una tanda de subida hay decenas de
    // fotos con el mismo createdAt al segundo, y un cursor que sólo mira la
    // fecha saltea o repite justo ahí.
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    // Con lista de ids no hay tandas: se pidieron esas y son esas.
    ...(listaIds ? {} : { take: TANDA + 1 }),
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: { id: true, previewKey: true, bibNumbers: true, width: true, height: true },
  });

  // Se pide una de más para saber si hay siguiente sin contar el total, que
  // sería una segunda consulta para responder sí o no.
  const hayMas = !listaIds && filas.length > TANDA;
  const tanda = hayMas ? filas.slice(0, TANDA) : filas;

  return NextResponse.json(
    {
      fotos: await Promise.all(
        tanda.map(async (f) => ({
          id: f.id,
          previewUrl: await resolveMediaUrl(f.previewKey!),
          bibNumbers: f.bibNumbers,
          width: f.width,
          height: f.height,
        })),
      ),
      cursor: hayMas ? (tanda[tanda.length - 1]?.id ?? null) : null,
    },
    // Las fotos de un evento publicado cambian poco y las pide mucha gente a
    // la vez —el fotógrafo comparte el link y entran todos juntos—. Un minuto
    // de caché en el borde no atrasa nada visible y saca de encima la ráfaga.
    { headers: { "cache-control": "public, max-age=60, s-maxage=60" } },
  );
}
