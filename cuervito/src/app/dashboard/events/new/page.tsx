import { redirect } from "next/navigation";

import { auth } from "~/server/auth";

import { EventForm } from "../event-form";
import { createEventAction } from "../actions";

export default async function NewEventPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/dashboard/events/new");

  return (
    <main className="wrap-narrow">
      <div className="head">
        <div>
          <h1>Nuevo evento</h1>
          <div className="sub">Empezá con la info básica. Lo demás lo editás después.</div>
        </div>
      </div>

      <EventForm action={createEventAction} submitLabel="Crear evento" />
    </main>
  );
}
