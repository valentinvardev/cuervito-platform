import Link from "next/link";
import { CalendarDays, ExternalLink, ImageOff, Settings2 } from "lucide-react";

import { db } from "~/server/db";
import { resolveMediaUrl } from "~/server/media";

export const dynamic = "force-dynamic";

/**
 * Todos los eventos de la plataforma, con su portada.
 *
 * El admin tenía usuarios, ventas y métricas, pero no había forma de mirar el
 * CATÁLOGO: qué se publicó, cómo se ve y si la portada quedó bien. Para
 * revisar una tienda había que entrar al usuario, sacar su slug y armar la URL
 * a mano.
 *
 * Son las mismas tarjetas que ve el fotógrafo en Eventos (.evs / .ec), con dos
 * diferencias: el dueño en la meta, y dos destinos al pie —la tienda pública,
 * que es lo que se quiere chequear, y la edición— en vez de una tarjeta que
 * es un solo link.
 */

/** Cuántos se traen. El VPS mueve pocos datos por segundo; 60 portadas ya son
 *  varias pantallas y quien busque uno viejo tiene el buscador de usuarios. */
const TANDA = 60;

function pesos(centavos: number) {
  return "$" + Math.round(centavos / 100).toLocaleString("es-AR");
}

export default async function AdminEventos() {
  // La recaudación se pide agrupada y aparte, no colgada de cada evento: con
  // el include, Supabase manda una fila por VENTA para mostrar un número por
  // evento, y eso engorda solo a medida que se vende.
  const [eventos, recaudado] = await Promise.all([
    db.event.findMany({
      orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }],
      take: TANDA,
      select: {
        id: true,
        slug: true,
        name: true,
        coverUrl: true,
        eventDate: true,
        location: true,
        isPublished: true,
        status: true,
        owner: { select: { name: true, slug: true } },
        _count: { select: { photos: { where: { deletedAt: null, fileSize: { not: null } } } } },
      },
    }),
    db.sale.groupBy({
      by: ["eventId"],
      where: { status: "PAID" },
      _sum: { sellerNetCents: true },
    }),
  ]);

  const vendidoPor = new Map(recaudado.map((r) => [r.eventId, r._sum.sellerNetCents ?? 0]));

  // Las portadas se guardan como CLAVE de S3 y hay que resolverlas. Las que
  // empiezan con http son las viejas, cargadas pegando una dirección a mano.
  const portadas = new Map(
    await Promise.all(
      eventos.map(async (e) => {
        if (!e.coverUrl) return [e.id, null] as const;
        if (e.coverUrl.startsWith("http")) return [e.id, e.coverUrl] as const;
        return [e.id, await resolveMediaUrl(e.coverUrl).catch(() => null)] as const;
      }),
    ),
  );

  return (
    <main className="canvas">
      <div className="canvas-in">
        <div className="head">
          <div>
            <h1>Eventos</h1>
            <p>{eventos.length} más recientes · cada uno abre la tienda como la ve el atleta.</p>
          </div>
        </div>

        {eventos.length === 0 ? (
          <div className="empty">
            <div className="empty-i">
              <CalendarDays />
            </div>
            <h3>Todavía no hay eventos</h3>
            <p>Cuando un fotógrafo cree el primero, aparece acá.</p>
          </div>
        ) : (
          <section className="evs">
            {eventos.map((e) => {
              const portada = portadas.get(e.id) ?? null;
              const vendido = vendidoPor.get(e.id) ?? 0;
              const publico = e.owner.slug && e.slug ? `/${e.owner.slug}/${e.slug}` : null;

              return (
                <div key={e.id} className="ec">
                  <div
                    className="ec-cv"
                    style={portada ? { backgroundImage: `url(${portada})`, backgroundSize: "cover" } : undefined}
                  >
                    {!portada && (
                      <div className="ec-none">
                        <ImageOff />
                        <span>Sin portada</span>
                      </div>
                    )}
                  </div>

                  {/* El estado va sobre la portada: en una grilla de sesenta,
                      saber cuáles están sin publicar es lo primero que se busca. */}
                  {e.status === "ARCHIVED" ? (
                    <span className="pill bad">
                      <i /> Archivado
                    </span>
                  ) : e.isPublished ? (
                    <span className="pill live">
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
                      <span>{e.owner.name ?? "sin nombre"}</span>
                      {e.eventDate && (
                        <>
                          <i />
                          <span>
                            {e.eventDate.toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })}
                          </span>
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
                      {vendido > 0 ? <b className="tnum">{pesos(vendido)}</b> : <b className="pale">—</b>}
                    </div>
                  </div>

                  <div className="ec-acc">
                    {publico ? (
                      <a href={publico} target="_blank" rel="noopener" className="btn btn-ghost btn-sm">
                        <ExternalLink /> Ver tienda
                      </a>
                    ) : (
                      // Sin slug del fotógrafo o del evento no hay URL pública que
                      // armar. Decirlo evita que parezca que el botón falla.
                      <span className="ec-nota">Sin dirección pública</span>
                    )}
                    <Link href={`/dashboard/evento/${e.id}`} className="btn btn-ghost btn-sm">
                      <Settings2 /> Editar
                    </Link>
                  </div>
                </div>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}
