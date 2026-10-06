import "server-only";

import { getS3ObjectBytes } from "~/server/s3";

import type { DatosPieza } from "./render";

/**
 * Los datos de una pieza a partir del evento y de su dueño.
 *
 * Los usan el estudio (api/dashboard/historias) y la vista previa del mail de
 * "¿ya lo compartiste?" (api/correos/historia). Tienen que salir iguales: la
 * historia que el mail muestra es la que el fotógrafo va a encontrar al tocar
 * el botón, y si se armaran en dos lugares, el día que uno cambie el formato
 * de la fecha el mail estaría mostrando otra pieza.
 */
export async function datosDePieza(
  ev: {
    name: string;
    eventDate: Date | null;
    location: string | null;
    discipline: string | null;
    pricePerPhoto: unknown;
    /** Cuántas fotos tiene, ya contadas por quien llama. */
    fotos: number;
  },
  dueno: { slug: string | null; storefrontBrandColor: string | null; logoKey: string | null } | null,
): Promise<DatosPieza> {
  // El logo va como data URI porque satori no sale a la red: le damos los
  // bytes o no hay logo. Que falte no puede romper la pieza entera, así que si
  // S3 falla se sigue sin él.
  let logo: string | null = null;
  if (dueno?.logoKey) {
    try {
      const b = Buffer.from(await getS3ObjectBytes(dueno.logoKey));
      logo = `data:image/png;base64,${b.toString("base64")}`;
    } catch {
      logo = null;
    }
  }

  return {
    evento: ev.name,
    fecha: ev.eventDate
      ? ev.eventDate.toLocaleDateString("es-AR", { day: "numeric", month: "long" })
      : null,
    lugar: ev.location,
    disciplina: ev.discipline,
    fotos: ev.fotos,
    precio: `$${Number(ev.pricePerPhoto).toLocaleString("es-AR")}`,
    direccion: `encontrate.app/${dueno?.slug ?? ""}`,
    logo,
    color: dueno?.storefrontBrandColor ?? "#F0410F",
  };
}
