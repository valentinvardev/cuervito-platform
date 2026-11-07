import { notFound } from "next/navigation";

import { env } from "~/env";
import { accesoEvento } from "~/server/acceso-evento";
import { dondeApartadaPreview } from "~/server/cola-fotos";
import { db } from "~/server/db";
import { puedeUsarHistorias } from "~/server/historias/acceso";
import { resolveMediaUrl } from "~/server/media";
import { barridoDe } from "~/lib/barrido";

import { pesos, sesionPanel } from "../../_components/sesion";
import type { Colaborador } from "./_equipo";
import { Pantalla } from "./_pantalla";

export const dynamic = "force-dynamic";

// Techo de fotos que se traen. La grilla pagina de a 20, pero el filtro y la
// búsqueda por dorsal trabajan sobre el conjunto, así que hace falta tenerlo
// en memoria. Con más que esto conviene mover el filtrado al servidor.
const TOPE = 600;

export default async function V2Evento({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ dorsal?: string | string[] }>;
}) {
  const { id } = await params;
  // ?dorsal= viene del buscador de la barra: llega con las fotos de ese
  // dorsal ya filtradas. Con el mismo saneo que el campo de dorsal.
  const pedido = (await searchParams).dorsal;
  const dorsal = (Array.isArray(pedido) ? pedido[0] : pedido)?.replace(/[^0-9]/g, "").slice(0, 5) ?? "";
  const { userId, nombre, rol, historiasEnabled } = await sesionPanel();

  // Quién mira: el dueño, un colaborador o un admin (ver acceso-evento.ts).
  // Antes la pregunta era sólo "¿dueño o admin?", y al colaborador que
  // acababa de aceptar la invitación lo recibía un 404.
  const acceso = await accesoEvento(id, { id: userId, role: rol });
  if (!acceso) notFound();

  const e = await db.event.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      name: true,
      location: true,
      discipline: true,
      description: true,
      eventDate: true,
      coverUrl: true,
      isPublished: true,
      pricePerPhoto: true,
      platformFeePct: true,
      recognition: true,
      bibDetection: true,
      sweep: true,
      ownerId: true,
      // Si esta cuenta puede regalar. Es lo que decide qué significa poner el
      // precio en cero: entregar gratis, o dejar el evento sin poder cobrarse.
      // El nombre y la dirección, para cuando lo abre otro que no es el dueño.
      owner: { select: { giftEnabled: true, name: true, slug: true, storefrontSweep: true } },
      sales: { where: { status: "PAID" }, select: { sellerNetCents: true } },
      collaborators: {
        orderBy: { invitedAt: "asc" },
        select: {
          id: true,
          invitedEmail: true,
          status: true,
          commissionScope: true,
          commissionPct: true,
          inviteToken: true,
          user: { select: { id: true, name: true } },
        },
      },
    },
  });
  if (!e) notFound();

  const comoAdmin = acceso.rol === "admin" ? (e.owner.name ?? "otro fotógrafo") : null;
  const comoColaborador = acceso.rol === "colaborador" ? (e.owner.name ?? "otro fotógrafo") : null;
  const puedeRegalar = e.owner.giftEnabled;
  // Para el modal de "subí una a tu historia" al terminar de subir. Es del
  // dueño: las historias son de su página, no de la de quien colabora.
  const historias =
    acceso.rol === "duenio" && (await puedeUsarHistorias({ id: userId, role: rol, historiasEnabled }));

  // Al colaborador la pantalla le habla de SUS fotos: la grilla, los conteos,
  // el reconocimiento y lo vendido son sobre lo que subió él. Lo de los demás
  // lo ve en la tienda, como cualquiera.
  const mias = comoColaborador ? { uploadedById: userId } : {};
  const visibles = { eventId: id, deletedAt: null, fileSize: { not: null }, ...mias };

  // Los conteos van al servidor y no se sacan del arreglo de fotos: ese está
  // topeado en TOPE, así que en un evento grande contar sobre él daría
  // "580 de 580" cuando hay 3.000.
  const [fotos, total, reconocidas, conDorsal, vendidas, noVisibles, noSePudieron, porSubidor, comisiones] =
    await Promise.all([
      db.photo.findMany({
        where: visibles,
        orderBy: { createdAt: "desc" },
        take: TOPE,
        select: {
          id: true,
          bibNumbers: true,
          previewKey: true,
          previewCleanKey: true,
          ocrProcessedAt: true,
          // Las caras indexadas de cada foto. Es lo que se muestra al pasar el
          // mouse, y es el dato que dice si esa foto la va a encontrar alguien:
          // una foto sin caras existe en la galería y no aparece en ninguna
          // búsqueda por selfie.
          _count: { select: { faceRecords: true } },
        },
      }),
      // Los tres con EXACTAMENTE el mismo filtro que la grilla, incluido
      // fileSize: una fila sin tamaño es una subida que se firmó y nunca llegó,
      // y no es una foto: no se ve, no se puede vender y no se va a reconocer
      // nunca. Contándolas, un evento de 12 fotos decía "12 de 15 reconocidas"
      // y se quedaba ahí para siempre, porque esas tres no existen.
      db.photo.count({ where: visibles }),
      db.photo.count({ where: { ...visibles, ocrProcessedAt: { not: null } } }),
      db.photo.count({
        where: { ...visibles, AND: [{ bibNumbers: { not: null } }, { bibNumbers: { not: "" } }] },
      }),
      // Cada foto vendida, con quién la subió: marca la grilla y, para el
      // dueño, cuenta cuántas vendió cada uno del equipo.
      db.saleItem.findMany({
        where: {
          sale: { eventId: id, status: "PAID" },
          ...(comoColaborador ? { photo: { uploadedById: userId } } : {}),
        },
        select: { photoId: true, photo: { select: { uploadedById: true } } },
      }),
      /* Cuántas NO se ven todavía en la tienda.

         Es a propósito una pregunta distinta de la que hace la cola. La cola
         pregunta "a qué le falta trabajo", que incluye el lease y los intentos;
         esto pregunta "qué no se ve", que es lo único que le importa al
         fotógrafo. No es la misma regla escrita dos veces: son dos preguntas. */
      db.photo.count({ where: { ...visibles, previewKey: null } }),
      /* Las que se dieron por perdidas. El único arreglo posible es que las
         vuelva a exportar, así que hay que nombrarlas. Con el predicado de la
         cola y no con un número: una foto que todavía está en los reintentos
         lentos no está perdida, y si el fotógrafo la vuelve a subir y el
         reintento sale bien, queda dos veces en la tienda. */
      db.photo.findMany({
        where: { eventId: id, ...mias, ...dondeApartadaPreview() },
        select: { filename: true },
        take: 6,
      }),
      // Cuántas subió cada uno. Por quién la subió y no por el dueño: en Photo
      // el dueño es siempre el del evento, y contando por eso el colaborador
      // daba cero y el dueño se llevaba las de todos.
      db.photo.groupBy({
        by: ["uploadedById"],
        where: { eventId: id, deletedAt: null },
        _count: { _all: true },
      }),
      // Lo devengado a cada colaborador en este evento. Se calcula al pagarse
      // cada venta (server/commissions.ts); acá sólo se suma.
      db.saleCommission.groupBy({
        by: ["userId"],
        where: { sale: { eventId: id } },
        _sum: { amountCents: true },
      }),
    ]);

  // Cuántas veces se vendió cada foto, no sólo si se vendió: una foto que
  // compraron seis personas es la que conviene mirar para saber qué funciona.
  const ventasPorFoto = new Map<string, number>();
  const vendidasPor = new Map<string, number>();
  for (const v of vendidas) {
    if (v.photoId) ventasPorFoto.set(v.photoId, (ventasPorFoto.get(v.photoId) ?? 0) + 1);
    // Las fotos de antes de que existiera "quién la subió" son del dueño.
    const quien = v.photo?.uploadedById ?? e.ownerId;
    vendidasPor.set(quien, (vendidasPor.get(quien) ?? 0) + 1);
  }
  const fotosDe = new Map<string, number>();
  for (const g of porSubidor) {
    const quien = g.uploadedById ?? e.ownerId;
    fotosDe.set(quien, (fotosDe.get(quien) ?? 0) + g._count._all);
  }
  const comisionDe = new Map(comisiones.map((c) => [c.userId, c._sum.amountCents ?? 0]));

  const conUrl = await Promise.all(
    fotos.map(async (f) => ({
      id: f.id,
      url: await resolveMediaUrl(f.previewCleanKey ?? f.previewKey ?? "").catch(() => null),
      bib: f.bibNumbers,
      vendida: (ventasPorFoto.get(f.id) ?? 0) > 0,
      ventas: ventasPorFoto.get(f.id) ?? 0,
      caras: f._count.faceRecords,
      reconocida: f.ocrProcessedAt !== null,
    })),
  );

  // El equipo. La plata —vendidas, lo que se le debe— y los emails los ve
  // sólo el dueño: al colaborador se le prometió que no ve las ventas de los
  // demás. El link de la invitación también es del dueño, que es quien lo
  // manda por WhatsApp cuando el mail no llegó.
  const esDuenio = acceso.rol === "duenio";
  const colaboradores: Colaborador[] = e.collaborators.map((c) => ({
    id: c.id,
    nombre: c.user?.name ?? c.invitedEmail.split("@")[0]!,
    email: comoColaborador ? null : c.invitedEmail,
    estado: c.status,
    alcance: c.commissionScope,
    pct: c.commissionPct,
    soyYo: c.user?.id === userId,
    fotos: c.user ? (fotosDe.get(c.user.id) ?? 0) : 0,
    vendidas: comoColaborador || !c.user ? null : (vendidasPor.get(c.user.id) ?? 0),
    comision: comoColaborador || !c.user ? null : pesos(comisionDe.get(c.user.id) ?? 0),
    link: esDuenio && c.status === "PENDING" ? `/invitacion/${c.inviteToken}` : null,
  }));
  const deudaTotal = comisiones.reduce((a, c) => a + (c._sum.amountCents ?? 0), 0);

  // Lo del colaborador que está mirando: cuántas vendió y cuánto le toca.
  const miFila = e.collaborators.find((c) => c.user?.id === userId);
  const miParte =
    comoColaborador && miFila
      ? {
          fotos: fotosDe.get(userId) ?? 0,
          vendidas: vendidasPor.get(userId) ?? 0,
          comision: pesos(comisionDe.get(userId) ?? 0),
          pct: miFila.commissionPct,
          alcance: miFila.commissionScope,
        }
      : null;
  const totalEvento = [...fotosDe.values()].reduce((a, n) => a + n, 0);

  const cover = e.coverUrl
    ? e.coverUrl.startsWith("http")
      ? e.coverUrl
      : await resolveMediaUrl(e.coverUrl).catch(() => null)
    : null;

  return (
    <Pantalla
      evento={{
        id: e.id,
        nombre: e.name,
        fecha: e.eventDate
          ? e.eventDate.toLocaleDateString("es-AR", { day: "numeric", month: "long" })
          : null,
        // En UTC y no con toISOString sobre la fecha local: el evento se guarda
        // a medianoche UTC, así que en Argentina (-3) la fecha local del día
        // anterior, y el campo mostraba un día menos cada vez que se abría.
        fechaISO: e.eventDate ? e.eventDate.toISOString().slice(0, 10) : null,
        lugar: e.location,
        disciplina: e.discipline,
        portada: cover,
        publicado: e.isPublished,
        // pricePerPhoto es Decimal(10,2) en PESOS, no en centavos.
        precio: Number(e.pricePerPhoto),
        // La del evento. Los creados antes de que existiera la columna la
        // tienen en null y siguen con la global.
        comision: e.platformFeePct !== null ? Number(e.platformFeePct) : env.PLATFORM_FEE_PERCENT,
        puedeRegalar,
        reconocimiento: e.recognition,
        leeDorsales: e.bibDetection,
        barrido: barridoDe(e.sweep, e.owner.storefrontSweep) !== "apagado",
        barridoHeredado: e.sweep === null,
        maxFoto: env.QUOTA_MAX_PHOTO_BYTES,
        descripcion: e.description,
        total,
        reconocidas,
        conDorsal,
        noVisibles,
        noSePudieron: noSePudieron.map((f) => f.filename),
        // La recaudación es del dueño. Al colaborador no se le manda ni en el
        // HTML: lo suyo viaja en miParte.
        ventas: comoColaborador ? 0 : e.sales.length,
        recaudado: comoColaborador ? "" : pesos(e.sales.reduce((a, s) => a + s.sellerNetCents, 0)),
      }}
      fotos={conUrl}
      historias={historias}
      colaboradores={colaboradores}
      deudaTotal={deudaTotal > 0 ? pesos(deudaTotal) : null}
      publico={e.isPublished && e.slug && e.owner.slug ? `/${e.owner.slug}/${e.slug}` : null}
      yo={comoAdmin ?? comoColaborador ?? nombre}
      fotosDelDueno={fotosDe.get(e.ownerId) ?? 0}
      vendidasDelDueno={comoColaborador ? null : (vendidasPor.get(e.ownerId) ?? 0)}
      totalEvento={totalEvento}
      dorsalInicial={dorsal}
      comoAdmin={comoAdmin}
      comoColaborador={comoColaborador}
      miParte={miParte}
    />
  );
}
