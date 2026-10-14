import Link from "next/link";

import { resolveAvatarUrl } from "~/server/avatar";
import { bandeja, hiloAdmin } from "~/server/chat";

import { Bandeja } from "./_bandeja";

export const dynamic = "force-dynamic";

const FILTROS = [
  ["abiertas", "Abiertas"],
  ["resueltas", "Resueltas"],
  ["todas", "Todas"],
] as const;
type Filtro = (typeof FILTROS)[number][0];

/**
 * La bandeja del chat de soporte: las conversaciones a la izquierda, la
 * elegida (?c=) a la derecha. El layout ya garantizó el rol.
 *
 * La lista y el hilo salen de la base en cada carga; lo que llega después lo
 * trae el SSE de la bandeja (ver _bandeja.tsx), que para los fotógrafos es
 * lo que cuenta como "hay un admin en línea".
 */
export default async function AdminChatPage(props: { searchParams: Promise<{ c?: string; f?: string }> }) {
  const sp = await props.searchParams;
  const filtro: Filtro = FILTROS.some(([f]) => f === sp.f) ? (sp.f as Filtro) : "abiertas";
  const [filas, hilo] = await Promise.all([bandeja(filtro), sp.c ? hiloAdmin(sp.c) : null]);
  const foto = hilo ? await resolveAvatarUrl(hilo.usuario.image) : null;

  return (
    <main className="canvas">
      <div className="canvas-in">
        <div className="head">
          <div>
            <h1>Chat</h1>
            <p>
              Lo que escriben los fotógrafos desde la burbuja del panel. Con esta pantalla abierta, ellos ven
              «En línea»; si nadie la tiene abierta, les avisamos por mail que respondiste.
            </p>
          </div>
          <div className="head-r">
            <div className="seg">
              {FILTROS.map(([f, t]) => (
                <Link
                  key={f}
                  href={`/admin/chat?f=${f}${sp.c ? `&c=${encodeURIComponent(sp.c)}` : ""}`}
                  aria-current={f === filtro ? "true" : undefined}
                  prefetch={false}
                >
                  {t}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <Bandeja filas={filas} hilo={hilo} foto={foto} filtro={filtro} />
      </div>
    </main>
  );
}
