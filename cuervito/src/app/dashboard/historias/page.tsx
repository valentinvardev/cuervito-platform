import { notFound, redirect } from "next/navigation";

import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { puedeUsarHistorias } from "~/server/historias/acceso";

import { Estudio } from "./_estudio";

export const dynamic = "force-dynamic";

/**
 * El estudio de historias.
 *
 * Cerrado por [acceso.ts]: hoy sólo ADMIN, más los ids que estén cargados a
 * mano en Setting. notFound() y no redirect(): para quien no tiene la beta,
 * esta ruta directamente no existe, y eso es más honesto que mandarlo al
 * inicio sin decirle por qué.
 */
export default async function HistoriasPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/dashboard/historias");
  if (!(await puedeUsarHistorias(session.user))) notFound();

  // Sólo eventos con fotos ya procesadas: sin previewCleanKey no hay de dónde
  // sacar la imagen, y ofrecer un evento vacío es ofrecer un callejón.
  const eventos = await db.event.findMany({
    where: {
      ownerId: session.user.id,
      NOT: { status: "ARCHIVED" },
      photos: { some: { deletedAt: null, previewCleanKey: { not: null } } },
    },
    orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }],
    take: 40,
    select: {
      id: true,
      name: true,
      eventDate: true,
      _count: { select: { photos: { where: { deletedAt: null, previewCleanKey: { not: null } } } } },
    },
  });

  return (
    <main className="canvas">
      <div className="canvas-in">
        <div className="head">
          <div>
            <h1>Historias</h1>
            <p>Armá la pieza para Instagram con una foto del evento.</p>
          </div>
        </div>

        <Estudio
          eventos={eventos.map((e) => ({
            id: e.id,
            nombre: e.name,
            fecha: e.eventDate
              ? e.eventDate.toLocaleDateString("es-AR", { day: "numeric", month: "long" })
              : null,
            fotos: e._count.photos,
          }))}
        />
      </div>
    </main>
  );
}
