import Link from "next/link";
import { CalendarDays, ImageOff, Plus } from "lucide-react";

import { db } from "~/server/db";

import { pesos, sesionV2 } from "../_components/sesion";

export const dynamic = "force-dynamic";

export default async function V2Eventos() {
  const { userId } = await sesionV2();

  const eventos = await db.event.findMany({
    where: { ownerId: userId, NOT: { status: "ARCHIVED" } },
    orderBy: { eventDate: "desc" },
    select: {
      id: true,
      name: true,
      location: true,
      eventDate: true,
      coverUrl: true,
      isPublished: true,
      status: true,
      _count: { select: { photos: true } },
      sales: { where: { status: "PAID" }, select: { sellerNetCents: true } },
    },
  });

  const totalFotos = eventos.reduce((a, e) => a + e._count.photos, 0);

  return (
    <main className="canvas">
        <div className="canvas-in">
          <div className="head">
            <div>
              <h1>Eventos</h1>
              <p>
                {eventos.length} {eventos.length === 1 ? "evento" : "eventos"},{" "}
                {totalFotos.toLocaleString("es-AR")} fotos.
              </p>
            </div>
          </div>

          {eventos.length > 0 ? (
            <section className="evs">
              {eventos.map((e) => {
                const vendido = e.sales.reduce((a, s) => a + s.sellerNetCents, 0);
                const portada = e.coverUrl?.startsWith("http") ? e.coverUrl : null;
                return (
                  <Link key={e.id} href={`/dashboard/events/${e.id}`} className="ec">
                    <div
                      className="ec-cv"
                      style={portada ? { backgroundImage: `url(${portada})`, backgroundSize: "cover" } : undefined}
                    >
                      {/* Sin portada se dice, no se disimula con un gris: un
                          evento sin portada vende bastante menos. */}
                      {!portada && (
                        <div className="ec-none">
                          <ImageOff />
                          <span>Sin portada</span>
                        </div>
                      )}
                    </div>

                    {e.isPublished ? (
                      <span className="pill">
                        <i /> Publicado
                      </span>
                    ) : (
                      <span className="pill draft">
                        <i /> Borrador
                      </span>
                    )}

                    <div className="ec-b">
                      <h3>{e.name}</h3>
                      <div className="ec-meta">
                        {e.eventDate
                          ? e.eventDate.toLocaleDateString("es-AR", { day: "numeric", month: "long" })
                          : "Sin fecha"}
                        {e.location && (
                          <>
                            <i /> {e.location}
                          </>
                        )}
                      </div>
                    </div>

                    <div className="ec-st">
                      <div>
                        <span>Fotos</span>
                        <b className="tnum">{e._count.photos.toLocaleString("es-AR")}</b>
                      </div>
                      <div>
                        <span>Vendido</span>
                        {vendido > 0 ? (
                          <b className="tnum">{pesos(vendido)}</b>
                        ) : (
                          <b className="pale">—</b>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </section>
          ) : (
            <div className="empty">
              <div className="empty-i">
                <CalendarDays />
              </div>
              <h3>No se encontraron eventos</h3>
              <p>Cuando crees tu primer evento y subas fotos, van a aparecer acá.</p>
              <Link href="/dashboard/events/new" className="btn btn-pri">
                <Plus /> Crear mi primer evento
              </Link>
            </div>
          )}
        </div>
      </main>
  );
}
