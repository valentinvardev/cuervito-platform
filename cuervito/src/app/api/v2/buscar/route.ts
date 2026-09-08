import { NextResponse } from "next/server";

import { auth } from "~/server/auth";
import { db } from "~/server/db";

/**
 * Buscador del panel nuevo.
 *
 * Va como route handler y no como server action: las acciones son POST y se
 * encolan de a una, así que escribiendo rápido cada tecla espera a la anterior
 * y el buscador se siente pegajoso. Un GET se puede cancelar con AbortController
 * cuando llega la tecla siguiente, que es justo lo que hace falta acá.
 */
export async function GET(req: Request) {
  const session = await auth();
  /* Cualquier sesión, no sólo admin.

     Acá había un `role !== "ADMIN"` de cuando el panel era una vista previa
     que sólo veíamos nosotros. Cuando el panel se abrió a todos, el candado
     se sacó de las páginas y se olvidó acá. El resultado: para todo fotógrafo
     real, escribir dos letras en la barra devolvía un 403 con `{error:"no"}`,
     el buscador lo guardaba como si fueran resultados y el panel entero se
     caía en blanco. Nosotros no lo veíamos nunca, porque somos admin.

     No hace falta más control que la sesión: cada consulta de abajo ya está
     acotada al userId, así que nadie busca en lo de otro. */
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sesión expirada." }, { status: 401 });
  }

  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ eventos: [], ventas: [], dorsal: null });

  const userId = session.user.id;
  const soloDigitos = /^\d+$/.test(q);

  const [eventos, ventas, dorsal] = await Promise.all([
    db.event.findMany({
      where: {
        ownerId: userId,
        NOT: { status: "ARCHIVED" },
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { location: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 4,
      orderBy: { eventDate: "desc" },
      select: { id: true, name: true, eventDate: true, _count: { select: { photos: true } } },
    }),

    db.sale.findMany({
      where: {
        sellerId: userId,
        OR: [
          { buyerName: { contains: q, mode: "insensitive" } },
          { buyerEmail: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 4,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        buyerName: true,
        buyerEmail: true,
        sellerNetCents: true,
        event: { select: { name: true } },
      },
    }),

    // El dorsal se guarda como lista separada por comas, así que se busca por
    // coincidencia parcial. Sólo se cuenta: la lista de fotos vive adentro del
    // evento, y traerla acá sería armar una segunda galería en un desplegable.
    soloDigitos
      ? db.photo.count({
          where: { ownerId: userId, deletedAt: null, bibNumbers: { contains: q } },
        })
      : Promise.resolve(null),
  ]);

  return NextResponse.json({
    eventos: eventos.map((e) => ({
      id: e.id,
      nombre: e.name,
      meta: `${e.eventDate ? e.eventDate.toLocaleDateString("es-AR", { day: "numeric", month: "long" }) : "Sin fecha"} · ${e._count.photos.toLocaleString("es-AR")} fotos`,
    })),
    ventas: ventas.map((v) => ({
      id: v.id,
      nombre: v.buyerName ?? v.buyerEmail,
      meta: `${v.event.name} · $${Math.round(v.sellerNetCents / 100).toLocaleString("es-AR")}`,
    })),
    dorsal: dorsal !== null ? { numero: q, fotos: dorsal } : null,
  });
}
