import { notFound, redirect } from "next/navigation";

import { auth } from "~/server/auth";
import { db } from "~/server/db";

import { updateEventAction, type EventFormState } from "../../actions";
import { EventForm } from "../../event-form";

export default async function EditEventPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const session = await auth();
  if (!session?.user?.id) redirect(`/login?callbackUrl=/dashboard/events/${id}/edit`);

  const ev = await db.event.findUnique({
    where: { id },
    select: {
      ownerId: true,
      name: true,
      discipline: true,
      location: true,
      eventDate: true,
      pricePerPhoto: true,
      description: true,
    },
  });
  if (!ev || ev.ownerId !== session.user.id) notFound();

  // Bind the id into the action so the form doesn't need to know it
  async function actionWithId(prev: EventFormState, fd: FormData): Promise<EventFormState> {
    "use server";
    return updateEventAction(id, prev, fd);
  }

  return (
    <main className="wrap-narrow">
      <div className="head">
        <div>
          <h1>Editar evento</h1>
          <div className="sub">Actualizá la información del evento.</div>
        </div>
      </div>

      <EventForm
        action={actionWithId}
        submitLabel="Guardar cambios"
        initial={{
          name: ev.name,
          discipline: ev.discipline,
          location: ev.location,
          eventDate: ev.eventDate ? ev.eventDate.toISOString() : null,
          pricePerPhoto: Number(ev.pricePerPhoto),
          description: ev.description,
        }}
      />
    </main>
  );
}
