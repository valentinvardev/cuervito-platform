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
 *
 * Sin `tipo` busca en todo a la vez, pocos de cada cosa. Con `tipo` (la pill
 * que se elige en el panel) busca sólo eso y trae más: quien eligió "Venta"
 * ya dijo qué busca, y cuatro renglones le cortan la lista justo donde
 * empieza a servir.
 */
const TIPOS = ["dorsal", "evento", "venta"] as const;
type Tipo = (typeof TIPOS)[number];

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

  const params = new URL(req.url).searchParams;
  const q = (params.get("q") ?? "").trim();
  const crudo = params.get("tipo");
  const tipo: Tipo | null = TIPOS.find((t) => t === crudo) ?? null;
  const nada = { eventos: [], ventas: [], dorsal: null, dorsalEventos: [] };

  // Un dorsal puede tener una sola cifra; un nombre de una letra no dice nada.
  if (q.length < (tipo === "dorsal" ? 1 : 2)) return NextResponse.json(nada);

  const userId = session.user.id;
  const soloDigitos = /^\d+$/.test(q);
  if (tipo === "dorsal" && !soloDigitos) return NextResponse.json(nada);

  const cuantos = tipo ? 8 : 4;
  const busca = (t: Tipo) => tipo === null || tipo === t;

  /* El dorsal se guarda como lista separada por comas ("123,456"), y se busca
     por PREFIJO de cada número, igual que el campo de dorsal del evento: así
     "12" encuentra 1247 y 1288, y no 312. Con un `contains` suelto, la cuenta
     de acá y lo que mostraba el evento al llegar no coincidían. */
  const dondeDorsal = {
    ownerId: userId,
    deletedAt: null,
    OR: [{ bibNumbers: { startsWith: q } }, { bibNumbers: { contains: `,${q}` } }],
  };

  const [eventos, ventas, dorsal, porEvento] = await Promise.all([
    busca("evento")
      ? db.event.findMany({
          where: {
            ownerId: userId,
            NOT: { status: "ARCHIVED" },
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { location: { contains: q, mode: "insensitive" } },
            ],
          },
          take: cuantos,
          orderBy: { eventDate: "desc" },
          select: { id: true, name: true, eventDate: true, _count: { select: { photos: true } } },
        })
      : Promise.resolve([]),

    busca("venta")
      ? db.sale.findMany({
          where: {
            sellerId: userId,
            OR: [
              { buyerName: { contains: q, mode: "insensitive" } },
              { buyerEmail: { contains: q, mode: "insensitive" } },
            ],
          },
          take: cuantos,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            buyerName: true,
            buyerEmail: true,
            sellerNetCents: true,
            event: { select: { name: true } },
          },
        })
      : Promise.resolve([]),

    // En la búsqueda general, sólo la cuenta: el renglón invita a elegir el
    // tipo dorsal, que es donde se ve en qué eventos está.
    tipo === null && soloDigitos ? db.photo.count({ where: dondeDorsal }) : Promise.resolve(null),

    // Con el tipo elegido, en qué eventos aparece y cuántas fotos en cada uno:
    // la lista de fotos vive adentro del evento, y traerla acá sería armar una
    // segunda galería en un desplegable.
    tipo === "dorsal"
      ? db.photo.groupBy({
          by: ["eventId"],
          where: dondeDorsal,
          _count: { _all: true },
          orderBy: { _count: { eventId: "desc" } },
          take: cuantos,
        })
      : Promise.resolve([]),
  ]);

  const eventosDelDorsal = porEvento.length
    ? await db.event.findMany({
        where: { id: { in: porEvento.map((p) => p.eventId) }, NOT: { status: "ARCHIVED" } },
        select: { id: true, name: true, eventDate: true },
      })
    : [];
  const fecha = (d: Date | null) =>
    d ? d.toLocaleDateString("es-AR", { day: "numeric", month: "long" }) : "Sin fecha";

  return NextResponse.json({
    eventos: eventos.map((e) => ({
      id: e.id,
      nombre: e.name,
      meta: `${fecha(e.eventDate)} · ${e._count.photos.toLocaleString("es-AR")} fotos`,
    })),
    ventas: ventas.map((v) => ({
      id: v.id,
      nombre: v.buyerName ?? v.buyerEmail,
      meta: `${v.event.name} · $${Math.round(v.sellerNetCents / 100).toLocaleString("es-AR")}`,
    })),
    dorsal: dorsal !== null ? { numero: q, fotos: dorsal } : null,
    // En el orden de la cuenta, el que más fotos tiene primero.
    dorsalEventos: porEvento.flatMap((p) => {
      const e = eventosDelDorsal.find((x) => x.id === p.eventId);
      if (!e) return [];
      const n = p._count._all;
      return [{ id: e.id, nombre: e.name, meta: `${n.toLocaleString("es-AR")} ${n === 1 ? "foto" : "fotos"} · ${fecha(e.eventDate)}` }];
    }),
  });
}
