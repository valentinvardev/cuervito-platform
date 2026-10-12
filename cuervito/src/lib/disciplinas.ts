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

/** Un texto como parte de una dirección: sin acentos, en minúscula, con guiones. */
export function slugDe(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** «Triatlón» → «triatlon»: la parte de /eventos/triatlon. */
export function slugDisciplina(d: Disciplina): string {
  return slugDe(d);
}

export function disciplinaDeSlug(slug: string): Disciplina | null {
  return DISCIPLINAS.find((d) => slugDe(d) === slug) ?? null;
}

/**
 * Las provincias con los nombres con que la gente las escribe. Lo que sale
 * de un campo libre es «Bs As», «bs. as.», «Provincia de Buenos Aires»: tres
 * formas de la misma página. La clave es el nombre sin acentos en minúscula.
 */
const PROVINCIAS: Record<string, string> = {
  "buenos aires": "Buenos Aires",
  "bs as": "Buenos Aires",
  "bs. as.": "Buenos Aires",
  "bsas": "Buenos Aires",
  "pba": "Buenos Aires",
  "provincia de buenos aires": "Buenos Aires",
  "pcia de buenos aires": "Buenos Aires",
  "pcia. de buenos aires": "Buenos Aires",
  "caba": "CABA",
  "capital federal": "CABA",
  "capital": "CABA",
  "ciudad autonoma de buenos aires": "CABA",
  "ciudad de buenos aires": "CABA",
  "catamarca": "Catamarca",
  "chaco": "Chaco",
  "chubut": "Chubut",
  "cordoba": "Córdoba",
  "corrientes": "Corrientes",
  "entre rios": "Entre Ríos",
  "formosa": "Formosa",
  "jujuy": "Jujuy",
  "la pampa": "La Pampa",
  "la rioja": "La Rioja",
  "mendoza": "Mendoza",
  "misiones": "Misiones",
  "neuquen": "Neuquén",
  "rio negro": "Río Negro",
  "salta": "Salta",
  "san juan": "San Juan",
  "san luis": "San Luis",
  "santa cruz": "Santa Cruz",
  "santa fe": "Santa Fe",
  "sta fe": "Santa Fe",
  "sta. fe": "Santa Fe",
  "santiago del estero": "Santiago del Estero",
  "tierra del fuego": "Tierra del Fuego",
  "tucuman": "Tucumán",
};

/**
 * La provincia de un lugar escrito como «Ciudad, Provincia»; null si no hay
 * coma o no se reconoce. Es lo que arma las páginas por provincia, así que
 * mejor no tener página que tenerla con un nombre mal escrito.
 */
export function provinciaDe(lugar: string | null | undefined): string | null {
  const partes = lugar?.split(",") ?? [];
  const cola = partes.slice(1).join(",").trim();
  if (!cola) return null;
  const clave = cola
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ");
  return PROVINCIAS[clave] ?? null;
}
