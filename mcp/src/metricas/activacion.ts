import type { Consulta } from "../db.js";
import { aTimestamp, type Periodo } from "../periodo.js";
import { tasa } from "../privacidad.js";

/**
 * Activación: de los fotógrafos que se registraron en el período, cuántos
 * llegaron a crear un evento y cuántos a subir fotos.
 *
 * Es una COHORTE: se mira sólo a los que se registraron en el período, y se
 * cuenta lo que hicieron hasta el FIN del período, no hasta hoy. Así dos
 * semanas se comparan en igualdad de condiciones: si se contara hasta hoy, la
 * semana de hace un mes tendría tres semanas más para activarse y siempre se
 * vería mejor.
 *
 * Una foto cuenta si terminó de subirse (`fileSize` no nulo) y no se borró.
 */
export const SQL_ACTIVACION = `
with cohorte as (
  select id from "User"
  where role = 'PHOTOGRAPHER'
    and "createdAt" >= $1::timestamp
    and "createdAt" <  $2::timestamp
)
select
  (select count(*) from cohorte)::int as registrados,
  (select count(*) from cohorte c
     where exists (
       select 1 from "Event" e
       where e."ownerId" = c.id and e."createdAt" < $2::timestamp
     ))::int as con_evento,
  (select count(*) from cohorte c
     where exists (
       select 1 from "Photo" p
       where p."ownerId" = c.id
         and p."fileSize" is not null
         and p."deletedAt" is null
         and p."createdAt" < $2::timestamp
     ))::int as con_fotos
`;

type Fila = { registrados: number; con_evento: number; con_fotos: number };

export type Activacion = {
  photographers_registered: number;
  photographers_with_event: number;
  photographers_with_photos: number;
  registered_no_event: number;
  event_no_photos: number;
  rates: { with_event: number | null; with_photos: number | null; event_to_photos: number | null };
};

export async function activacion(q: Consulta, p: Periodo): Promise<Activacion> {
  const [f] = await q<Fila>(SQL_ACTIVACION, [aTimestamp(p.desde), aTimestamp(p.hasta)]);
  const registrados = f?.registrados ?? 0;
  const conEvento = f?.con_evento ?? 0;
  const conFotos = f?.con_fotos ?? 0;
  return {
    photographers_registered: registrados,
    photographers_with_event: conEvento,
    photographers_with_photos: conFotos,
    registered_no_event: registrados - conEvento,
    event_no_photos: conEvento - conFotos,
    rates: {
      with_event: tasa(conEvento, registrados),
      with_photos: tasa(conFotos, registrados),
      event_to_photos: tasa(conFotos, conEvento),
    },
  };
}
