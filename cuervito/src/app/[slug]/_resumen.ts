import "server-only";

import { cache } from "react";

import { disciplinaDe } from "~/lib/disciplinas";
import { db } from "~/server/db";

/**
 * Lo que la página del fotógrafo dice de él sin que lo escriba: qué
 * disciplinas cubre, cuántos eventos, cuántas fotos y desde cuándo. Sale de
 * sus eventos publicados, no de un campo del perfil: un campo más es un campo
 * más que nadie llena (ver lib/disciplinas.ts), y los eventos ya están.
 *
 * Es lo que lee quien busca «fotógrafo deportivo en [ciudad]» —el organizador—
 * y lo que lee Google para saber de qué trata la página.
 */
export const perfilDerivado = cache(async (userId: string) => {
  const donde = { ownerId: userId, isPublished: true, NOT: { status: "ARCHIVED" as const } };
  const [porDisciplina, eventos, fotos, primero] = await Promise.all([
    db.event.groupBy({ by: ["discipline"], where: donde, _count: { _all: true } }),
    db.event.count({ where: donde }),
    db.photo.count({ where: { event: donde, deletedAt: null, fileSize: { not: null } } }),
    db.event.findFirst({
      where: { ...donde, eventDate: { not: null } },
      orderBy: { eventDate: "asc" },
      select: { eventDate: true },
    }),
  ]);

  // Normalizadas a la lista («running» y «Running» son una), las más
  // cubiertas primero. «Otra» y las vacías no dicen nada: afuera.
  const conteo = new Map<string, number>();
  for (const d of porDisciplina) {
    const n = disciplinaDe(d.discipline);
    if (!n || n === "Otra") continue;
    conteo.set(n, (conteo.get(n) ?? 0) + d._count._all);
  }
  const disciplinas = [...conteo.entries()].sort((a, b) => b[1] - a[1]).map(([d]) => d);

  return { disciplinas, eventos, fotos, desde: primero?.eventDate?.getUTCFullYear() ?? null };
});

export type PerfilDerivado = Awaited<ReturnType<typeof perfilDerivado>>;

/** «running, trail y MTB» */
function listar(xs: string[]): string {
  if (xs.length <= 1) return xs.join("");
  return `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`;
}

/**
 * El párrafo del perfil y la descripción de la página, una sola frase:
 * «Fotos de running, trail y MTB en Tandil. 12 eventos y 4.800 fotos desde
 * 2024. Buscá las tuyas por dorsal o con una selfie.» Sin ciudad o sin
 * disciplinas, la frase se acorta: no se inventa nada.
 */
export function textoPerfil(ciudad: string | null, d: PerfilDerivado): string {
  // En minúscula dentro de la frase, salvo las siglas («MTB» sigue siendo MTB).
  const enFrase = (x: string) => (x === x.toUpperCase() ? x : x.toLowerCase());
  const que = d.disciplinas.length > 0 ? `Fotos de ${listar(d.disciplinas.map(enFrase))}` : "Fotos de eventos deportivos";
  const donde = ciudad ? ` en ${ciudad}` : "";
  const cuanto =
    d.eventos > 0
      ? ` ${d.eventos.toLocaleString("es-AR")} ${d.eventos === 1 ? "evento" : "eventos"} y ${d.fotos.toLocaleString("es-AR")} fotos${d.desde ? ` desde ${d.desde}` : ""}.`
      : "";
  return `${que}${donde}.${cuanto} Buscá las tuyas por dorsal o con una selfie.`;
}
