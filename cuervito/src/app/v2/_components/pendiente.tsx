import Link from "next/link";
import { ArrowRight, Hammer } from "lucide-react";

import { Shell } from "./shell";
import { sesionV2 } from "./sesion";

/**
 * Pantalla todavía no rediseñada.
 *
 * Existe como ruta /v2 a propósito. La alternativa era que el riel apuntara al
 * panel actual, y eso te expulsa de la versión nueva en el primer click: para
 * comparar dos diseños hay que poder recorrer uno sin que te saque a mitad de
 * camino. Acá se conserva el armazón, se dice la verdad y se ofrece el enlace
 * a la pantalla que sí existe.
 */
export async function Pendiente({
  activo,
  titulo,
  bajada,
  actual,
}: {
  activo: string;
  titulo: string;
  bajada: string;
  actual: string;
}) {
  const { nombre, slug, iniciales } = await sesionV2();

  return (
    <Shell nombre={nombre} slug={slug} iniciales={iniciales} activo={activo}>
      <main className="canvas">
        <div className="canvas-in">
          <div className="head">
            <div>
              <h1>{titulo}</h1>
              <p>{bajada}</p>
            </div>
          </div>

          <div className="card">
            <div className="pendiente">
              <div className="pendiente-i">
                <Hammer />
              </div>
              <h2>Esta pantalla todavía no está rediseñada</h2>
              <p>
                Está diseñada en el laboratorio pero todavía no portada al producto. Mientras tanto
                podés usar la versión actual, que funciona igual.
              </p>
              <Link href={actual} className="btn btn-pri">
                Ir a la versión actual <ArrowRight className="go" />
              </Link>
            </div>
          </div>
        </div>
      </main>
    </Shell>
  );
}
