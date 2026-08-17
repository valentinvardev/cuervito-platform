import "server-only";

import { db } from "~/server/db";

/**
 * Apagar la lectura de dorsales cuando el evento no tiene dorsales.
 *
 * No todas las carreras usan número. En un trail de montaña, una salida de
 * ciclismo o una sesión de entrenamiento no hay nada que leer, y el OCR es una
 * llamada paga a Rekognition por CADA foto que nunca va a devolver nada. En un
 * evento de tres mil fotos eso es plata tirada tres mil veces.
 *
 * Se mira una muestra de las primeras fotos procesadas y se decide una sola
 * vez. La búsqueda por cara no se toca: ésa sigue siempre, porque es la que
 * hace que el atleta encuentre sus fotos.
 */

/** Cuántas fotos procesadas hacen falta para decidir. */
const MUESTRA = 10;

/**
 * Un dorsal plausible: de 2 a 5 dígitos.
 *
 * El techo es porque cualquier número más largo que eso en la remera de alguien
 * no es un dorsal: es el año de fundación del club, un teléfono de sponsor o un
 * número de serie que el OCR levantó de un cartel. El piso es 2 porque hay
 * carreras chicas que numeran del 1 al 40, y descartarlas dejaría sin dorsal a
 * eventos que sí los usan.
 */
const DORSAL = /^\d{2,5}$/;

export function pareceDorsal(bibNumbers: string | null): boolean {
  if (!bibNumbers) return false;
  return bibNumbers
    .split(",")
    .map((b) => b.trim())
    .some((b) => DORSAL.test(b));
}

/**
 * Corre después de cada OCR. Barata: dos conteos, y sólo hasta que decide.
 *
 * Devuelve true si acaba de apagar la lectura de dorsales.
 */
export async function evaluarDorsales(eventId: string): Promise<boolean> {
  const ev = await db.event.findUnique({
    where: { id: eventId },
    select: { bibDetection: true, bibCheckedAt: true },
  });
  // Ya se decidió, o ya está apagado: no hay nada que mirar.
  if (!ev || ev.bibCheckedAt !== null || !ev.bibDetection) return false;

  const procesadas = await db.photo.findMany({
    where: {
      eventId,
      deletedAt: null,
      fileSize: { not: null },
      ocrProcessedAt: { not: null },
    },
    orderBy: { ocrProcessedAt: "asc" },
    take: MUESTRA,
    select: { bibNumbers: true },
  });

  // Todavía no hay muestra suficiente.
  if (procesadas.length < MUESTRA) return false;

  const conDorsal = procesadas.filter((p) => pareceDorsal(p.bibNumbers)).length;

  // Con que UNA de las diez tenga un número plausible alcanza para seguir. El
  // umbral es bajo a propósito: apagar de más le saca al fotógrafo la búsqueda
  // por dorsal sin que él haya pedido nada, y eso es peor que gastar de más.
  const sigue = conDorsal > 0;

  await db.event.update({
    where: { id: eventId },
    data: { bibCheckedAt: new Date(), bibDetection: sigue },
  });

  if (!sigue) {
    console.log(
      `[dorsales] ${eventId}: 0 de ${MUESTRA} con dorsal, se apaga la lectura de texto`,
    );
  }
  return !sigue;
}
