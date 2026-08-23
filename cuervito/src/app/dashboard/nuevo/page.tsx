import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { sesionPanel } from "../_components/sesion";
import { Asistente } from "./_asistente";

export const dynamic = "force-dynamic";

export default async function V2Nuevo() {
  await sesionPanel();

  return (
    <main className="canvas">
      <div className="canvas-in">
        <div className="head">
          <div>
            <Link
              href="/dashboard/eventos"
              className="btn btn-ghost btn-sm"
              style={{ marginBottom: "var(--s-3)" }}
            >
              <ArrowLeft /> Eventos
            </Link>
            <h1>Nuevo evento</h1>
          </div>
        </div>

        <Asistente />
      </div>
    </main>
  );
}
