import Link from "next/link";

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
 * Cada tarjeta abre la tienda pública en una pestaña nueva. Es una vista
 * previa de verdad —la página que ve el atleta, no una maqueta— porque lo que
 * se quiere chequear es justamente eso.
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
    <div className="wrap-narrow">
      <div className="head">
        <h1>Eventos</h1>
        <p className="sub">
          {eventos.length} más recientes · cada uno abre la tienda como la ve el atleta
        </p>
      </div>

      {eventos.length === 0 ? (
        <div className="section">
          <p className="sub">Todavía no hay eventos en la plataforma.</p>
        </div>
      ) : (
        <div className="adm-ev-grid">
          {eventos.map((e) => {
            const portada = portadas.get(e.id) ?? null;
            const vendido = vendidoPor.get(e.id) ?? 0;
            const publico = e.owner.slug && e.slug ? `/${e.owner.slug}/${e.slug}` : null;

            return (
              <div key={e.id} className="adm-ev">
                <div className="adm-ev-portada">
                  {portada ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={portada} alt="" loading="lazy" />
                  ) : (
                    <span className="adm-ev-sin">
                      <i className="ti ti-photo-off" />
                      Sin portada
                    </span>
                  )}
                  {/* El estado va SOBRE la portada: en una grilla de sesenta,
                      saber cuáles están sin publicar es lo primero que se
                      busca, y abajo del nombre se pierde entre el resto. */}
                  <span className="adm-ev-estado" data-pub={e.isPublished ? "1" : undefined}>
                    {e.status === "ARCHIVED"
                      ? "Archivado"
                      : e.isPublished
                        ? "Publicado"
                        : "Borrador"}
                  </span>
                </div>

                <div className="adm-ev-cuerpo">
                  <b>{e.name}</b>
                  <div className="adm-ev-meta">
                    <span>{e.owner.name ?? "sin nombre"}</span>
                    {e.eventDate && (
                      <>
                        <i />
                        <span>
                          {e.eventDate.toLocaleDateString("es-AR", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </>
                    )}
                  </div>

                  <div className="adm-ev-nums">
                    <span>{e._count.photos.toLocaleString("es-AR")} fotos</span>
                    <i />
                    <span>{vendido > 0 ? pesos(vendido) : "sin ventas"}</span>
                  </div>

                  <div className="adm-ev-acc">
                    {publico ? (
                      <a
                        href={publico}
                        target="_blank"
                        rel="noopener"
                        className="btn btn-outline btn-sm"
                      >
                        <i className="ti ti-external-link" /> Ver tienda
                      </a>
                    ) : (
                      // Sin slug del fotógrafo o del evento no hay URL pública
                      // que armar. Decirlo evita que parezca que el botón falla.
                      <span className="adm-ev-nota">Sin dirección pública</span>
                    )}
                    <Link href={`/dashboard/evento/${e.id}`} className="btn btn-ghost btn-sm">
                      <i className="ti ti-settings" /> Editar
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
