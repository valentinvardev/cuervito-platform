"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { esPlantilla } from "~/app/_portfolio/plantillas/registro";
import type { PortfolioDesign } from "~/app/_portfolio/store";
import type { Prisma } from "../../../../generated/prisma";
import { db } from "~/server/db";
import { resolveMediaUrl } from "~/server/media";
import { disenoDe } from "~/server/portfolio";
import { borrarVersionesHuerfanas, empujarPortfolio } from "~/server/portfolio-fotos";

import { usuarioPortfolio } from "./_acceso";
import { sanearDiseno } from "./_sanear";

/**
 * Las acciones del panel de Portfolio. Cada una empieza por usuarioPortfolio()
 * —quién es y si puede usar Portfolio— y por verificar que el portfolio, el
 * evento o la foto sean suyos: el id lo manda el navegador y puede ser
 * cualquiera.
 */

type Resultado = { error: string | null };

const SIN_ACCESO = { error: "No tenés acceso a esto." } as const;

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, "La dirección tiene que tener al menos 2 letras.")
  .max(60, "La dirección es demasiado larga.")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Sólo letras, números y guiones.");

const fotosSchema = z
  .array(z.object({ photoId: z.string().min(1), grupo: z.string().trim().min(1).max(80) }))
  .max(200, "Un portfolio puede tener hasta 200 fotos.");

export type FotoParaElegir = { id: string; src: string; ventas: number };

function refrescar(portfolioId?: string) {
  revalidatePath("/dashboard/portfolio");
  if (portfolioId) revalidatePath(`/dashboard/portfolio/${portfolioId}`);
}

/* ── Elegir fotos ────────────────────────────────────────────────────────── */

const POR_PAGINA = 60;

/**
 * Las fotos de un evento para el asistente y para "agregar fotos".
 *
 * "vendidas" ordena por ventas cobradas: lo que más se vendió suele ser lo
 * mejor del evento, y es un dato que sólo tiene encontrate. Si el evento no
 * vendió nada, cae a todas.
 *
 * La imagen es la miniatura (560px, con marca): es una grilla de elegir, no la
 * del portfolio, y la limpia de 2400px haría la pantalla veinte veces más
 * pesada.
 */
export async function fotosDeEventoAction(
  eventId: string,
  orden: "vendidas" | "todas",
  desde = 0,
): Promise<{ error: string | null; fotos: FotoParaElegir[]; hayMas: boolean; orden: "vendidas" | "todas" }> {
  const userId = await usuarioPortfolio();
  if (!userId) return { ...SIN_ACCESO, fotos: [], hayMas: false, orden };
  const ev = await db.event.findFirst({ where: { id: eventId, ownerId: userId }, select: { id: true } });
  if (!ev) return { error: "No encontramos ese evento.", fotos: [], hayMas: false, orden };

  const listas = { deletedAt: null, previewCleanKey: { not: null } } as const;
  const sel = { id: true, thumbKey: true, previewKey: true } as const;

  if (orden === "vendidas") {
    const ventas = await db.saleItem.groupBy({
      by: ["photoId"],
      where: { photo: { eventId, ...listas }, sale: { status: "PAID" } },
      _count: { _all: true },
      orderBy: { _count: { photoId: "desc" } },
      skip: desde,
      take: POR_PAGINA + 1,
    });
    if (ventas.length > 0 || desde > 0) {
      const ids = ventas.slice(0, POR_PAGINA).flatMap((v) => (v.photoId ? [v.photoId] : []));
      const fotos = await db.photo.findMany({ where: { id: { in: ids } }, select: sel });
      const porId = new Map(fotos.map((f) => [f.id, f]));
      const salida: FotoParaElegir[] = [];
      for (const v of ventas.slice(0, POR_PAGINA)) {
        const f = v.photoId ? porId.get(v.photoId) : undefined;
        const clave = f?.thumbKey ?? f?.previewKey;
        if (f && clave) salida.push({ id: f.id, src: await resolveMediaUrl(clave), ventas: v._count._all });
      }
      return { error: null, fotos: salida, hayMas: ventas.length > POR_PAGINA, orden: "vendidas" };
    }
    // Sin ventas: se muestran todas.
    orden = "todas";
  }

  const fotos = await db.photo.findMany({
    where: { eventId, ...listas },
    orderBy: { createdAt: "asc" },
    skip: desde,
    take: POR_PAGINA + 1,
    select: sel,
  });
  const salida: FotoParaElegir[] = [];
  for (const f of fotos.slice(0, POR_PAGINA)) {
    const clave = f.thumbKey ?? f.previewKey;
    if (clave) salida.push({ id: f.id, src: await resolveMediaUrl(clave), ventas: 0 });
  }
  return { error: null, fotos: salida, hayMas: fotos.length > POR_PAGINA, orden };
}

/** Si la dirección está libre entre los portfolios del usuario. */
export async function direccionLibreAction(slug: string, salvo?: string): Promise<{ libre: boolean; error: string | null }> {
  const userId = await usuarioPortfolio();
  if (!userId) return { libre: false, ...SIN_ACCESO };
  const s = slugSchema.safeParse(slug);
  if (!s.success) return { libre: false, error: s.error.issues[0]?.message ?? "Dirección inválida." };
  const ocupada = await db.portfolio.findFirst({
    where: { ownerId: userId, slug: s.data, ...(salvo ? { NOT: { id: salvo } } : {}) },
    select: { id: true },
  });
  return { libre: !ocupada, error: null };
}

/** Las fotos que se agregan tienen que ser del usuario y existir. */
async function fotosPropias(userId: string, ids: string[]): Promise<Set<string>> {
  const ok = await db.photo.findMany({
    where: { id: { in: ids }, ownerId: userId, deletedAt: null },
    select: { id: true },
  });
  return new Set(ok.map((f) => f.id));
}

/* ── Crear ───────────────────────────────────────────────────────────────── */

const crearSchema = z.object({
  nombre: z.string().trim().min(1, "Ponele un nombre.").max(80),
  slug: slugSchema,
  plantilla: z.string(),
  fotos: fotosSchema.min(1, "Elegí al menos una foto."),
});

export async function crearPortfolioAction(
  input: z.input<typeof crearSchema>,
): Promise<Resultado & { id?: string }> {
  const userId = await usuarioPortfolio();
  if (!userId) return SIN_ACCESO;
  const d = crearSchema.safeParse(input);
  if (!d.success) return { error: d.error.issues[0]?.message ?? "Revisá los datos." };
  if (!esPlantilla(d.data.plantilla)) return { error: "Esa plantilla no existe." };

  const propias = await fotosPropias(userId, d.data.fotos.map((f) => f.photoId));
  const fotos = d.data.fotos.filter((f) => propias.has(f.photoId));
  if (fotos.length === 0) return { error: "Esas fotos no están disponibles." };

  try {
    const p = await db.portfolio.create({
      data: {
        ownerId: userId,
        nombre: d.data.nombre,
        slug: d.data.slug,
        // Sólo la plantilla: textos, colores y fotos de portada salen de ella
        // y del perfil hasta que el fotógrafo los cambie en el editor.
        diseno: { templateId: d.data.plantilla } satisfies PortfolioDesign,
        fotos: { create: fotos.map((f, i) => ({ photoId: f.photoId, grupo: f.grupo, orden: i })) },
      },
      select: { id: true },
    });
    // Las versiones de 1600px empiezan a generarse ya, mientras el
    // fotógrafo mira el resultado.
    empujarPortfolio();
    refrescar();
    return { error: null, id: p.id };
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") return { error: "Ya tenés un portfolio con esa dirección." };
    throw e;
  }
}

/* ── Fotos ───────────────────────────────────────────────────────────────── */

/**
 * Las fotos del portfolio, en el orden y con los grupos que manda el panel.
 * Reemplaza la lista entera: lo que no viene, sale.
 */
export async function guardarFotosAction(
  portfolioId: string,
  lista: z.input<typeof fotosSchema>,
): Promise<Resultado> {
  const userId = await usuarioPortfolio();
  if (!userId) return SIN_ACCESO;
  const d = fotosSchema.safeParse(lista);
  if (!d.success) return { error: d.error.issues[0]?.message ?? "Revisá las fotos." };
  const p = await db.portfolio.findFirst({ where: { id: portfolioId, ownerId: userId }, select: { id: true } });
  if (!p) return SIN_ACCESO;

  const propias = await fotosPropias(userId, d.data.map((f) => f.photoId));
  const fotos = d.data.filter((f) => propias.has(f.photoId));
  const antes = await db.portfolioFoto.findMany({ where: { portfolioId }, select: { photoId: true } });
  const quedan = new Set(fotos.map((f) => f.photoId));
  const salen = antes.map((a) => a.photoId).filter((id) => !quedan.has(id));

  await db.$transaction([
    db.portfolioFoto.deleteMany({ where: { portfolioId } }),
    db.portfolioFoto.createMany({
      data: fotos.map((f, i) => ({ portfolioId, photoId: f.photoId, grupo: f.grupo, orden: i })),
    }),
    db.portfolio.update({ where: { id: portfolioId }, data: { updatedAt: new Date() } }),
  ]);
  await borrarVersionesHuerfanas(salen);
  empujarPortfolio();
  refrescar(portfolioId);
  return { error: null };
}

/* ── Datos del portfolio ─────────────────────────────────────────────────── */

const datosSchema = z.object({
  nombre: z.string().trim().min(1, "Ponele un nombre.").max(80),
  slug: slugSchema,
  seoTitulo: z.string().trim().max(70, "El título para Google, hasta 70 letras.").optional(),
  seoDescripcion: z.string().trim().max(160, "La descripción, hasta 160 letras.").optional(),
});

export async function guardarDatosAction(
  portfolioId: string,
  input: z.input<typeof datosSchema>,
): Promise<Resultado> {
  const userId = await usuarioPortfolio();
  if (!userId) return SIN_ACCESO;
  const d = datosSchema.safeParse(input);
  if (!d.success) return { error: d.error.issues[0]?.message ?? "Revisá los datos." };
  try {
    const r = await db.portfolio.updateMany({
      where: { id: portfolioId, ownerId: userId },
      data: {
        nombre: d.data.nombre,
        slug: d.data.slug,
        seoTitulo: d.data.seoTitulo ?? null,
        seoDescripcion: d.data.seoDescripcion ?? null,
      },
    });
    if (r.count === 0) return SIN_ACCESO;
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") return { error: "Ya tenés un portfolio con esa dirección." };
    throw e;
  }
  refrescar(portfolioId);
  return { error: null };
}

export async function publicarPortfolioAction(portfolioId: string, publicar: boolean): Promise<Resultado> {
  const userId = await usuarioPortfolio();
  if (!userId) return SIN_ACCESO;
  if (publicar) {
    const fotos = await db.portfolioFoto.count({ where: { portfolioId, photo: { deletedAt: null } } });
    if (fotos === 0) return { error: "Agregá al menos una foto antes de publicarlo." };
  }
  const r = await db.portfolio.updateMany({
    where: { id: portfolioId, ownerId: userId },
    data: { publicadoAt: publicar ? new Date() : null },
  });
  if (r.count === 0) return SIN_ACCESO;
  if (publicar) empujarPortfolio();
  refrescar(portfolioId);
  return { error: null };
}

export async function cambiarPlantillaAction(portfolioId: string, plantilla: string): Promise<Resultado> {
  const userId = await usuarioPortfolio();
  if (!userId) return SIN_ACCESO;
  if (!esPlantilla(plantilla)) return { error: "Esa plantilla no existe." };
  const p = await db.portfolio.findFirst({ where: { id: portfolioId, ownerId: userId }, select: { diseno: true } });
  if (!p) return SIN_ACCESO;
  // Los textos son de cada plantilla (ids distintos), así que no se pueden
  // llevar. Lo que sí es del portfolio y no de la plantilla, el contacto, se
  // conserva.
  const anterior = disenoDe(p);
  const nuevo: PortfolioDesign = { templateId: plantilla, ...(anterior.contact ? { contact: anterior.contact } : {}) };
  await db.portfolio.update({ where: { id: portfolioId }, data: { diseno: nuevo as Prisma.InputJsonValue } });
  refrescar(portfolioId);
  return { error: null };
}

/** El diseño que manda el editor, saneado: textos con HTML acotado, colores válidos. */
export async function guardarDisenoAction(portfolioId: string, diseno: unknown): Promise<Resultado> {
  const userId = await usuarioPortfolio();
  if (!userId) return SIN_ACCESO;
  const limpio = sanearDiseno(diseno);
  if (!limpio) return { error: "El diseño no es válido." };
  const r = await db.portfolio.updateMany({ where: { id: portfolioId, ownerId: userId }, data: { diseno: limpio as Prisma.InputJsonValue } });
  if (r.count === 0) return SIN_ACCESO;
  refrescar(portfolioId);
  return { error: null };
}

export async function borrarPortfolioAction(portfolioId: string): Promise<Resultado> {
  const userId = await usuarioPortfolio();
  if (!userId) return SIN_ACCESO;
  const fotos = await db.portfolioFoto.findMany({
    where: { portfolioId, portfolio: { ownerId: userId } },
    select: { photoId: true },
  });
  const r = await db.portfolio.deleteMany({ where: { id: portfolioId, ownerId: userId } });
  if (r.count === 0) return SIN_ACCESO;
  await borrarVersionesHuerfanas(fotos.map((f) => f.photoId));
  refrescar();
  return { error: null };
}

/* ── Consultas ───────────────────────────────────────────────────────────── */

export async function marcarConsultaAction(consultaId: string, leida: boolean): Promise<Resultado> {
  const userId = await usuarioPortfolio();
  if (!userId) return SIN_ACCESO;
  const r = await db.consultaPortfolio.updateMany({
    where: { id: consultaId, portfolio: { ownerId: userId } },
    data: { leidaAt: leida ? new Date() : null },
  });
  if (r.count === 0) return SIN_ACCESO;
  refrescar();
  return { error: null };
}

/** Los eventos del usuario que tienen fotos listas, para "agregar fotos". */
export async function eventosParaElegirAction(): Promise<{ id: string; nombre: string; fotos: number }[]> {
  const userId = await usuarioPortfolio();
  if (!userId) return [];
  const eventos = await db.event.findMany({
    where: { ownerId: userId, photos: { some: { deletedAt: null, previewCleanKey: { not: null } } } },
    orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }],
    take: 60,
    select: { id: true, name: true, _count: { select: { photos: { where: { deletedAt: null } } } } },
  });
  return eventos.map((e) => ({ id: e.id, nombre: e.name, fotos: e._count.photos }));
}
