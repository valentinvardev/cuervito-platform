/**
 * Las disciplinas de un evento, en una sola lista.
 *
 * Es una lista cerrada y no un campo libre porque el campo libre no se llena:
 * 36 de 44 eventos publicados estaban sin disciplina. Y es la misma lista en
 * el alta, en la edición y en el panel de administración, porque de acá
 * salen las páginas por disciplina (/eventos/running): dos listas distintas
 * son dos nombres para lo mismo y una página partida en dos.
 *
 * El valor guardado es el texto tal cual («Trail»): es lo que ya había en la
 * base y lo que la tienda muestra.
 */
export const DISCIPLINAS = [
  "Running",
  "Trail",
  "Ciclismo",
  "MTB",
  "Triatlón",
  "Duatlón",
  "Natación",
  "Fútbol",
  "Básquet",
  "Rugby",
  "Hockey",
  "Vóley",
  "Otra",
] as const;

export type Disciplina = (typeof DISCIPLINAS)[number];

/** Una disciplina guardada, normalizada a la lista («running» → «Running»). */
export function disciplinaDe(valor: string | null | undefined): Disciplina | null {
  if (!valor) return null;
  const v = valor.trim().toLowerCase();
  return DISCIPLINAS.find((d) => d.toLowerCase() === v) ?? null;
}

/**
 * Un lugar como se escribe, no como se tipeó: «chivilcoy» → «Chivilcoy».
 * Las partículas (de, del, la, los, las, y) quedan en minúscula.
 */
export function lugarBonito(lugar: string | null | undefined): string | null {
  const l = lugar?.trim();
  if (!l) return null;
  return l
    .split(/\s+/)
    .map((p, i) => (i > 0 && /^(de|del|la|las|los|y|e)$/i.test(p) ? p.toLowerCase() : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(" ");
}

/** La ciudad de un lugar escrito como «Ciudad, Provincia». */
export function ciudadDe(lugar: string | null | undefined): string | null {
  return lugarBonito(lugar?.split(",")[0]);
}
