import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { puedeUsarHistorias } from "~/server/historias/acceso";
import { FORMATOS } from "~/server/historias/formatos";
import { renderHistoria } from "~/server/historias/render";
import { getS3ObjectBytes } from "~/server/s3";

/**
 * Arma una historia y la devuelve.
 *
 * No la guarda en S3, y es a propósito mientras esto sea una beta: guardar
 * significa una tabla, una pantalla para verlas, y decidir cuándo se borran.
 * Nada de eso se puede diseñar bien antes de saber si la función se usa. La
 * imagen se genera en el momento y el fotógrafo se la baja; si mañana quiere
 * la misma, la vuelve a generar, que cuesta menos de un segundo.
 *
 * Devuelve el JPEG crudo y no un JSON con base64: el base64 pesa un tercio más
 * y obliga a la pantalla a decodificarlo a mano en vez de apuntarle un <img> a
 * un blob.
 */

export const runtime = "nodejs";
// sharp con una foto de 6000px y satori maquetando: cerca de un segundo en el
// VPS. El techo está para que un caso raro no quede colgado, no porque se
// espere llegar.
export const maxDuration = 30;

const esquema = z.object({
  photoId: z.string().min(1),
  plantilla: z.enum(["cubierta", "placa"]),
  formato: z.enum(["historia", "post"]),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!(await puedeUsarHistorias(session?.user))) {
    return NextResponse.json({ error: "No disponible." }, { status: 403 });
  }
  const userId = session!.user.id;

  const parsed = esquema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const { photoId, plantilla, formato } = parsed.data;

  // La foto tiene que ser suya. El where lleva el ownerId del evento y no sólo
  // el id de la foto: sin eso, cualquiera con la beta habilitada podría armar
  // una historia con la foto de otro fotógrafo mandando un id.
  const foto = await db.photo.findFirst({
    where: { id: photoId, deletedAt: null, event: { ownerId: userId } },
    select: {
      previewCleanKey: true,
      previewKey: true,
      event: {
        select: {
          name: true,
          eventDate: true,
          location: true,
          discipline: true,
          pricePerPhoto: true,
          _count: { select: { photos: { where: { fileSize: { not: null } } } } },
        },
      },
    },
  });
  if (!foto?.event) {
    return NextResponse.json({ error: "No encontramos esa foto." }, { status: 404 });
  }

  // SIN marca de agua. La marca existe para que nadie se lleve la foto sin
  // pagar; acá el que publica es el dueño, y una historia con la marca puesta
  // le está tapando su propia foto para protegerse de sí mismo.
  const clave = foto.previewCleanKey;
  if (!clave) {
    return NextResponse.json(
      { error: "Esa foto todavía se está procesando. Probá en un minuto." },
      { status: 409 },
    );
  }

  const [usuario, bytes] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: { slug: true, storefrontBrandColor: true, logoKey: true },
    }),
    getS3ObjectBytes(clave),
  ]);

  // El logo va como data URI porque satori no sale a la red: le damos los
  // bytes o no hay logo. Que falte no puede romper la historia entera, así que
  // si S3 falla se sigue sin él.
  let logo: string | null = null;
  if (usuario?.logoKey) {
    try {
      const b = Buffer.from(await getS3ObjectBytes(usuario.logoKey));
      logo = `data:image/png;base64,${b.toString("base64")}`;
    } catch {
      logo = null;
    }
  }

  const ev = foto.event;
  const imagen = await renderHistoria({
    foto: Buffer.from(bytes),
    plantilla,
    formato,
    datos: {
      evento: ev.name,
      fecha: ev.eventDate
        ? ev.eventDate.toLocaleDateString("es-AR", { day: "numeric", month: "long" })
        : null,
      lugar: ev.location,
      disciplina: ev.discipline,
      fotos: ev._count.photos,
      precio: `$${Number(ev.pricePerPhoto).toLocaleString("es-AR")}`,
      direccion: `encontrate.app/${usuario?.slug ?? ""}`,
      logo,
      color: usuario?.storefrontBrandColor ?? "#F0410F",
    },
  });

  return new NextResponse(new Uint8Array(imagen), {
    headers: {
      "content-type": "image/jpeg",
      "content-length": String(imagen.length),
      // Se genera para este pedido y no se reusa: pedir la misma combinación
      // otra vez tiene que volver a renderizar, porque el evento pudo cambiar
      // de precio o sumar fotos en el medio.
      "cache-control": "no-store",
      "content-disposition": `inline; filename="${formato}-${FORMATOS[formato].ancho}x${FORMATOS[formato].alto}.jpg"`,
    },
  });
}
