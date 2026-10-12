import Link from "next/link";

import { db } from "~/server/db";

import { FilaDatos } from "./_fila";

export const dynamic = "force-dynamic";

/**
 * Los eventos publicados a los que les falta disciplina o lugar.
 *
 * De esos dos campos sale lo que Google lee de cada evento (título, párrafo,
 * páginas por disciplina y ciudad). Eran libres y casi nadie los llenaba:
 * acá se completan de a uno, los más recientes primero. Cuando la lista
 * queda vacía, esta pantalla no tiene más trabajo.
 */
export default async function AdminEventosDatos() {
  const eventos = await db.event.findMany({
    where: { isPublished: true, NOT: { status: "ARCHIVED" }, OR: [{ discipline: null }, { location: null }, { discipline: "" }, { location: "" }] },
    orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }],
    take: 200,
    select: { id: true, name: true, eventDate: true, discipline: true, location: true, owner: { select: { name: true, slug: true } } },
  });

  return (
    <main className="canvas">
      <div className="canvas-in">
        <div className="head">
          <div>
            <h1>Datos de eventos</h1>
            <p>
              Publicados sin disciplina o sin lugar: {eventos.length}. De estos dos campos salen el título y el párrafo
              de cada página de evento, y las páginas por disciplina y ciudad.
            </p>
          </div>
          <div className="head-r">
            <Link href="/admin/eventos" className="btn btn-ghost">
              Todos los eventos
            </Link>
          </div>
        </div>

        <section className="card">
          {eventos.length === 0 ? (
            <div className="empty" style={{ padding: "var(--s-5) var(--s-4)" }}>
              <h3>Todos completos</h3>
              <p>Cada evento publicado tiene disciplina y lugar.</p>
            </div>
          ) : (
            <div className="admin-datos-lista">
              <div className="row row-h">
                <span>Evento</span>
                <span>Disciplina</span>
                <span>Lugar (Ciudad, Provincia)</span>
                <span />
              </div>
              {eventos.map((e) => (
                <FilaDatos
                  key={e.id}
                  evento={{
                    id: e.id,
                    nombre: e.name,
                    fotografo: e.owner.name ?? e.owner.slug ?? "",
                    fecha: e.eventDate
                      ? e.eventDate.toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
                      : null,
                    discipline: e.discipline,
                    location: e.location,
                  }}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
