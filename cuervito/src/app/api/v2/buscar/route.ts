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
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "no" }, { status: 403 });
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
