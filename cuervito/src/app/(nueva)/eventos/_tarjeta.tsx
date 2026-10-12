import { ArrowRight } from "lucide-react";
import Link from "next/link";

import type { EventoListado } from "~/server/listados";

/**
 * La tarjeta de un evento en un listado, con la misma forma que las del
 * buscador de /eventos (ver _buscador.tsx): portada, nombre, fecha y lugar,
 * y el botón a la galería. Es un componente de servidor: los listados por
 * disciplina y provincia se arman enteros en el servidor para que Google
 * los lea sin JavaScript.
 */
export function TarjetaEvento({ evento: e }: { evento: EventoListado }) {
  return (
    <div className="ev">
      <Link href={e.href} className="ev-cover" tabIndex={-1} aria-hidden="true">
        {e.portada ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={e.portada} alt="" loading="lazy" />
        ) : (
          <span>{e.nombre.toUpperCase()}</span>
        )}
      </Link>
      <div className="ev-body">
        <div className="t">{e.nombre}</div>
        <div className="m">
          {[e.fecha, e.lugar, `${e.fotos.toLocaleString("es-AR")} fotos`, e.fotografo.nombre].filter(Boolean).join(" · ")}
        </div>
        <Link href={e.href} className="btn btn-ghost">
          Buscar mis fotos <ArrowRight className="go" />
        </Link>
      </div>
    </div>
  );
}
