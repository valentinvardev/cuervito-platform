import "server-only";

import { cache } from "react";

import { DISCIPLINAS, disciplinaDe, provinciaDe, slugDe, type Disciplina } from "~/lib/disciplinas";
import { db } from "~/server/db";
import { resolveMediaUrl } from "~/server/media";

/**
 * Las páginas por disciplina (/eventos/running) y por provincia
 * (/eventos/cordoba, /fotografos/cordoba).
 *
 * Existen sólo cuando hay con qué llenarlas: tres eventos o más. Una página
 * de listado con un evento es una página vacía, y Google castiga al sitio
 * entero por tener muchas. Por eso todo sale de una sola función,
 * combosConPaginas, y las rutas dan 404 si el combo no está ahí.
 *
 * La provincia no es una columna: se lee de Event.location escrito como
 * «Ciudad, Provincia» (ver provinciaDe). Son decenas de eventos, así que se
 * traen todos los publicados una vez por pedido (cache de React) y se
 * agrupan acá.
 */

export const MINIMO_EVENTOS = 3;

export type Combo = {
  tipo: "disciplina" | "provincia";
  nombre: string;
  slug: string;
  eventos: number;
  fotos: number;
  fotografos: number;
  /** La fecha del evento más viejo, para «desde 2025». */
  desde: Date | null;
};

const cargar = cache(() =>
  db.event.findMany({
    where: {
      isPublished: true,
      NOT: { status: "ARCHIVED" },
      // Sólo lo que se puede abrir: la página del evento da 404 si el dueño
      // no está activo o no tiene tienda.
      owner: { status: "ACTIVE", onboardingCompletedAt: { not: null }, slug: { not: null } },
    },
    orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      slug: true,
      name: true,
      eventDate: true,
      location: true,
      discipline: true,
      coverUrl: true,
      owner: { select: { id: true, slug: true, name: true } },
      _count: { select: { photos: { where: { fileSize: { not: null }, deletedAt: null } } } },
      photos: {
        where: { previewKey: { not: null }, deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { previewKey: true },
      },
    },
  }),
);

type Fila = Awaited<ReturnType<typeof cargar>>[number];

/** «Otra» no es una disciplina para buscar: no tiene página. */
function disciplinaPagina(e: Fila): Disciplina | null {
  const d = disciplinaDe(e.discipline);
  return d && d !== "Otra" ? d : null;
}

function provinciaPagina(e: Fila): string | null {
  return provinciaDe(e.location);
}

function armarCombos(filas: Fila[], tipo: Combo["tipo"], claveDe: (e: Fila) => string | null): Combo[] {
  const grupos = new Map<string, { filas: Fila[]; duenos: Set<string> }>();
  for (const e of filas) {
    const k = claveDe(e);
    if (!k) continue;
    const g = grupos.get(k) ?? { filas: [], duenos: new Set() };
    g.filas.push(e);
    g.duenos.add(e.owner.id);
    grupos.set(k, g);
  }
  return [...grupos]
    .filter(([, g]) => g.filas.length >= MINIMO_EVENTOS)
    .map(([nombre, g]) => ({
      tipo,
      nombre,
      slug: slugDe(nombre),
      eventos: g.filas.length,
      fotos: g.filas.reduce((a, e) => a + e._count.photos, 0),
      fotografos: g.duenos.size,
      desde: g.filas.reduce<Date | null>((min, e) => (e.eventDate && (!min || e.eventDate < min) ? e.eventDate : min), null),
    }))
    .sort((a, b) => b.eventos - a.eventos);
}

/** Las disciplinas y provincias que tienen página hoy. */
export const combosConPaginas = cache(async (): Promise<{ disciplinas: Combo[]; provincias: Combo[] }> => {
  const filas = await cargar();
  return {
    disciplinas: armarCombos(filas, "disciplina", disciplinaPagina),
    provincias: armarCombos(filas, "provincia", provinciaPagina),
  };
});

/** El combo que responde a /eventos/[slug], o null: una disciplina le gana a una provincia del mismo nombre. */
export async function comboDe(slug: string): Promise<Combo | null> {
  const { disciplinas, provincias } = await combosConPaginas();
  return disciplinas.find((c) => c.slug === slug) ?? provincias.find((c) => c.slug === slug) ?? null;
}

export type EventoListado = {
  nombre: string;
  href: string;
  fecha: string | null;
  lugar: string | null;
  disciplina: Disciplina | null;
  fotos: number;
  portada: string | null;
  fotografo: { nombre: string; slug: string };
};

function fechaCorta(d: Date | null): string | null {
  // En UTC: la fecha del evento se guarda a medianoche UTC.
  return d ? d.toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : null;
}

async function portadaDe(e: Fila): Promise<string | null> {
  const clave = e.coverUrl ?? e.photos[0]?.previewKey ?? null;
  if (!clave) return null;
  if (clave.startsWith("http")) return clave;
  return resolveMediaUrl(clave).catch(() => null);
}

function filtrar(filas: Fila[], f: { disciplina?: Disciplina; provincia?: string }): Fila[] {
  return filas.filter(
    (e) => (!f.disciplina || disciplinaPagina(e) === f.disciplina) && (!f.provincia || provinciaPagina(e) === f.provincia),
  );
}

/** Los eventos de un combo, los más recientes primero, con su portada resuelta. */
export async function eventosDe(f: { disciplina?: Disciplina; provincia?: string }): Promise<EventoListado[]> {
  const filas = filtrar(await cargar(), f);
  return Promise.all(
    filas.map(async (e) => ({
      nombre: e.name,
      // ?src=search: la venta que salga de acá cuenta como tráfico de la
      // plataforma, no del link del fotógrafo (ver lib/visitor).
      href: `/${e.owner.slug}/${e.slug}?src=search`,
      fecha: fechaCorta(e.eventDate),
      lugar: e.location,
      disciplina: disciplinaPagina(e),
      fotos: e._count.photos,
      portada: await portadaDe(e),
      fotografo: { nombre: e.owner.name ?? "Fotógrafo", slug: e.owner.slug! },
    })),
  );
}

export type FotografoListado = {
  nombre: string;
  slug: string;
  eventos: number;
  fotos: number;
  disciplinas: Disciplina[];
};

/** Los fotógrafos con eventos en una provincia, los de más eventos primero. */
export async function fotografosDe(f: { provincia: string }): Promise<FotografoListado[]> {
  const filas = filtrar(await cargar(), f);
  const porDueno = new Map<string, FotografoListado & { disc: Set<Disciplina> }>();
  for (const e of filas) {
    const g = porDueno.get(e.owner.id) ?? {
      nombre: e.owner.name ?? "Fotógrafo",
      slug: e.owner.slug!,
      eventos: 0,
      fotos: 0,
      disciplinas: [],
      disc: new Set<Disciplina>(),
    };
    g.eventos++;
    g.fotos += e._count.photos;
    const d = disciplinaPagina(e);
    if (d) g.disc.add(d);
    porDueno.set(e.owner.id, g);
  }
  return [...porDueno.values()]
    .map(({ disc, ...g }) => ({ ...g, disciplinas: DISCIPLINAS.filter((d) => disc.has(d)) }))
    .sort((a, b) => b.eventos - a.eventos);
}

/**
 * Los combos del otro tipo con los que éste se cruza: desde una disciplina,
 * las provincias (con página) donde tiene eventos, y al revés. Son los
 * links que hacen que Google llegue de una página de listado a la otra.
 */
export async function cruces(c: Combo): Promise<Combo[]> {
  const [filas, { disciplinas, provincias }] = await Promise.all([cargar(), combosConPaginas()]);
  if (c.tipo === "disciplina") {
    const d = c.nombre as Disciplina;
    const conEsta = new Set(filas.filter((e) => disciplinaPagina(e) === d).map(provinciaPagina).filter(Boolean));
    return provincias.filter((p) => conEsta.has(p.nombre));
  }
  const conEsta = new Set(filas.filter((e) => provinciaPagina(e) === c.nombre).map(disciplinaPagina).filter(Boolean));
  return disciplinas.filter((d) => conEsta.has(d.nombre as Disciplina));
}
