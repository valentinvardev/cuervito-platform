import type { Consulta } from "../db.js";
import { aTimestamp, type Periodo } from "../periodo.js";

/**
 * Uso: lo que pasó en el período, sin mirar quién.
 *
 * Las búsquedas por cara salen de FaceSearchLog, que escribe la ruta de
 * búsqueda facial en cada intento. De esa tabla se cuenta la fila y nada más:
 * tiene visitorId y la lista de fotos que devolvió, y ninguna de las dos
 * columnas se lee.
 *
 * Las búsquedas por dorsal no se registran en ninguna tabla. AnalyticsEvent
 * iba a guardarlas y está vacía: nada en la aplicación le escribe. Por eso
 * salen como null con la razón, en vez de un cero que se leería como "nadie
 * buscó".
 */
export const SQL_USO = `
select
  (select count(*) from "Event"
     where "createdAt" >= $1::timestamp and "createdAt" < $2::timestamp)::int as eventos,
  (select count(*) from "Photo"
     where "createdAt" >= $1::timestamp and "createdAt" < $2::timestamp
       and "fileSize" is not null and "deletedAt" is null)::int as fotos,
  (select count(*) from "FaceSearchLog"
     where "createdAt" >= $1::timestamp and "createdAt" < $2::timestamp)::int as busquedas_cara
`;

type Fila = { eventos: number; fotos: number; busquedas_cara: number };

export const RAZON_DORSALES =
  "Las búsquedas por dorsal no se registran en ninguna tabla: la búsqueda existe, pero no deja rastro.";

export type Uso = {
  events_created: number;
  photos_uploaded: number;
  face_searches: number;
  dorsal_searches: null;
  unavailable_reason: { dorsal_searches: string };
};

export async function uso(q: Consulta, p: Periodo): Promise<Uso> {
  const [f] = await q<Fila>(SQL_USO, [aTimestamp(p.desde), aTimestamp(p.hasta)]);
  return {
    events_created: f?.eventos ?? 0,
    photos_uploaded: f?.fotos ?? 0,
    face_searches: f?.busquedas_cara ?? 0,
    dorsal_searches: null,
    unavailable_reason: { dorsal_searches: RAZON_DORSALES },
  };
}
