import "server-only";

import { cache } from "react";

import { urlPublica } from "~/lib/url-publica";
import { db } from "~/server/db";

/**
 * Otras ediciones de la misma carrera, y otros fotógrafos que la cubrieron.
 *
 * «Fotos del Maratón de X» se busca todos los años, y cada año hay un evento
 * nuevo (o dos, si lo cubrieron dos fotógrafos). Sin enlaces entre ellos son
 * páginas sueltas que compiten por la misma búsqueda; enlazadas, Google
 * entiende que son la misma carrera y la autoridad de la edición vieja le
 * sirve a la nueva.
 *
 * No hay una tabla de carreras (CanonicalEvent existe pero nadie la llena),
 * así que la carrera se deduce del nombre: sin año, sin ordinal, sin
 * acentos ni puntuación. «3ra Maratón de X 2025» y «Maratón de X 2026» dan
 * lo mismo. Es una heurística: junta lo que se llama igual, y nada más.
 */

const PARTICULAS = new Set(["de", "del", "la", "las", "los", "el", "y", "e", "en", "vs", "edicion", "fotos"]);

/** El nombre como carrera: minúsculas, sin acentos, sin año, sin ordinal, sin signos. */
export function nombreDeCarrera(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\b(19|20)\d{2}\b/g, " ")
    .replace(/\b\d{1,2}\s*(ra|da|ra\.|va|ta|ma|na|°|º|ª|a|o)\b/g, " ")
    .replace(/\bedici[oó]n\b/g, " ")
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .split(/\s+/)
    .filter((p) => p && !PARTICULAS.has(p))
    .join(" ");
}

export type Edicion = {
  nombre: string;
  anio: number | null;
  /** AAAA-MM-DD, o null. */
  fecha: string | null;
  fotografo: string;
  url: string;
  /** Del mismo fotógrafo que la página en la que se muestra. */
  mismoFotografo: boolean;
};

export const relacionadosDe = cache(async (evento: { id: string; name: string; ownerId?: string }): Promise<Edicion[]> => {
  const base = nombreDeCarrera(evento.name);
  if (!base) return [];
  // Los candidatos salen por la primera palabra con cuerpo (4 letras o más):
  // «maraton», «trail», «rural». Lo que coincida de verdad se decide en JS.
  const palabra = base.split(" ").find((p) => p.length >= 4) ?? base.split(" ")[0];
  if (!palabra) return [];

  const candidatos = await db.event.findMany({
    where: {
      id: { not: evento.id },
      isPublished: true,
      NOT: { status: "ARCHIVED" },
      name: { contains: palabra, mode: "insensitive" },
      owner: { status: "ACTIVE", onboardingCompletedAt: { not: null }, slug: { not: null } },
    },
    orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }],
    take: 40,
    select: {
      slug: true,
      name: true,
      eventDate: true,
      ownerId: true,
      owner: {
        select: {
          name: true,
          slug: true,
          customDomains: { where: { status: "ACTIVE" }, orderBy: { verifiedAt: "asc" }, take: 1, select: { hostname: true } },
        },
      },
    },
  });

  return candidatos
    .filter((c) => nombreDeCarrera(c.name) === base)
    .slice(0, 6)
    .map((c) => ({
      nombre: c.name,
      anio: c.eventDate?.getUTCFullYear() ?? null,
      fecha: c.eventDate?.toISOString().slice(0, 10) ?? null,
      fotografo: c.owner.name ?? "Fotógrafo",
      url: urlPublica(c.owner.slug!, c.owner.customDomains[0]?.hostname, c.slug),
      mismoFotografo: evento.ownerId !== undefined && c.ownerId === evento.ownerId,
    }));
});
