import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "~/server/auth";
import { getCachedEventsList } from "~/server/cached";

import { EventsList } from "./events-list";

export default async function EventsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/dashboard/events");

  const events = await getCachedEventsList(session.user.id);

  return (
    <main className="wrap-narrow">
      <div className="head">
        <div>
          <h1>Eventos</h1>
          <div className="sub">Gestioná tus eventos activos y finalizados.</div>
        </div>
        <Link href="/dashboard/events/new" className="btn btn-primary">
          <i className="ti ti-plus" />
          Nuevo evento
        </Link>
      </div>

      {events.length > 0 ? (
        <EventsList events={events} />
      ) : (
        <div className="empty-state">
          <div className="ic">
            <i className="ti ti-calendar-event" />
          </div>
          <h3>Todavía no tenés eventos</h3>
          <p>Creá tu primer evento y empezá a vender fotos. Tarda un minuto.</p>
          <Link href="/dashboard/events/new" className="btn btn-primary">
            <i className="ti ti-plus" />
            Crear primer evento
          </Link>
        </div>
      )}

      {events.length > 0 && (
        <Link href="/dashboard/events/new" className="event-list-add">
          <i className="ti ti-plus" />
          Crear nuevo evento
        </Link>
      )}
    </main>
  );
}
