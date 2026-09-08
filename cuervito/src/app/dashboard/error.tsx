"use client";

import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { useEffect } from "react";

/**
 * Cuando algo del panel explota, que explote el contenido y no el panel.
 *
 * No existía. Sin esto, cualquier excepción en cualquier componente cliente
 * —un `forEach` sobre algo que no era una lista, en el buscador— subía hasta
 * la raíz y Next reemplazaba TODO por una pantalla en blanco con "Application
 * error". Sin riel, sin barra, sin forma de ir a otro lado que no fuera
 * escribir la dirección a mano. Y así se enteraba un fotógrafo de que el
 * buscador estaba roto: mirando un fondo vacío.
 *
 * Vive en este segmento y no en la raíz a propósito: el error.tsx envuelve la
 * página, no el layout, así que el armazón de Shell queda montado y el botón
 * de reintentar y los links del riel siguen funcionando.
 */
export default function ErrorDelPanel({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // A la consola con el digest: es lo que hay que pegar para encontrarlo
    // en el log del servidor.
    console.error("[panel]", error);
  }, [error]);

  return (
    <main className="canvas">
      <div className="canvas-in">
        <div className="empty">
          <div className="empty-i">
            <RotateCcw />
          </div>
          <h3>Algo se rompió en esta pantalla</h3>
          <p>
            No es tu cuenta ni tus ventas: es un error nuestro. Probá de nuevo, y si sigue
            pasando, escribinos y contanos qué estabas haciendo.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <button type="button" className="btn btn-pri" onClick={reset}>
              Probar de nuevo
            </button>
            <Link href="/dashboard" className="btn btn-ghost">
              Ir al inicio
            </Link>
          </div>
          {error.digest && (
            <p style={{ fontSize: 11, opacity: 0.55, marginTop: 14 }}>
              Referencia: <code>{error.digest}</code>
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
