import Link from "next/link";

import { db } from "~/server/db";
import { resolveMediaUrl } from "~/server/media";

/**
 * Evento elegido como demo pública. Es una decisión editorial, no técnica:
 * conviene el que tenga portada propia, volumen de fotos y dorsales bien
 * visibles, porque es lo primero que prueba un fotógrafo que está evaluando
 * la plataforma.
 */
const DEMO_EVENT_SLUG = "duatlon-club-ciclista-chivilcoy";

function findDemoEvent(slug?: string) {
  return db.event.findFirst({
    where: {
      isPublished: true,
      status: { in: ["ACTIVE", "FINISHED"] },
      owner: { slug: { not: null } },
      photos: { some: { fileSize: { not: null }, deletedAt: null } },
      ...(slug ? { slug } : {}),
    },
    orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }],
    select: {
      name: true,
      slug: true,
      location: true,
      coverUrl: true,
      owner: { select: { slug: true } },
      _count: {
        select: { photos: { where: { fileSize: { not: null }, deletedAt: null } } },
      },
      // Fallback de portada: muchos eventos no tienen coverUrl cargada y el
      // bloque quedaba con un rectángulo gris.
      photos: {
        where: { previewKey: { not: null }, deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { previewKey: true },
      },
    },
  });
}

/**
 * "No nos creas, probá vos" apuntando a un evento real.
 *
 * La versión anterior de este bloque mandaba a /dashboard/events, que está
 * detrás del login: el visitante deslogueado no podía probar nada.
 *
 * Usa el evento fijado arriba y, si ese dejara de estar publicado, cae al
 * evento publicado más reciente con fotos. Así despublicarlo no vacía la
 * sección ni deja un link roto en la home.
 */
export async function DemoEventCta() {
  const event = (await findDemoEvent(DEMO_EVENT_SLUG)) ?? (await findDemoEvent());

  if (!event?.owner.slug) return null;

  const href = `/${event.owner.slug}/${event.slug}?src=demo`;
  const coverKey = event.coverUrl ?? event.photos[0]?.previewKey ?? null;
  const cover = coverKey
    ? coverKey.startsWith("http")
      ? coverKey
      : await resolveMediaUrl(coverKey).catch(() => null)
    : null;

  return (
    <section className="demo-band" id="demo">
      <div className="container">
        <div className="demo-card reveal">
          <div className="demo-text">
            <span className="eyebrow">
              <i className="ti ti-hand-click" style={{ fontSize: 14 }} />
              Probalo vos
            </span>
            <h2 className="h-section">Mirá exactamente lo que ve tu cliente.</h2>
            <p>
              Este es un evento real publicado en Cuervito. Buscá por dorsal,
              probá la búsqueda por selfie, meté fotos al carrito. Es el mismo
              flujo que van a usar los atletas de tu carrera.
            </p>
            <ul className="demo-steps">
              <li>
                <i className="ti ti-hash" />
                Buscar por dorsal
              </li>
              <li>
                <i className="ti ti-scan-eye" />
                Buscar por selfie
              </li>
              <li>
                <i className="ti ti-download" />
                Comprar y descargar
              </li>
            </ul>
          </div>

          <Link href={href} className="demo-event">
            <span
              className="demo-event-cover"
              style={cover ? { backgroundImage: `url(${cover})` } : undefined}
              aria-hidden="true"
            />
            <span className="demo-event-body">
              <span className="demo-event-tag">Evento real</span>
              <span className="demo-event-name">{event.name}</span>
              <span className="demo-event-meta">
                {[event.location, `${event._count.photos.toLocaleString("es-AR")} fotos`]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              <span className="demo-event-go">
                Abrir el evento
                <i className="ti ti-arrow-right" />
              </span>
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}
