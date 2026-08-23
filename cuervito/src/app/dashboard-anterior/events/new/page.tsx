import { redirect } from "next/navigation";

import { auth } from "~/server/auth";

import { NewEventShell } from "./new-event-shell";

export default async function NewEventPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/dashboard/events/new");

  return (
    <main className="wrap">
      <div className="head">
        <div>
          <h1>Nuevo evento</h1>
          <div className="sub">
            Completá los datos y mirá en vivo cómo se va a ver en el buscador público.
          </div>
        </div>
      </div>

      <NewEventShell />
    </main>
  );
}
