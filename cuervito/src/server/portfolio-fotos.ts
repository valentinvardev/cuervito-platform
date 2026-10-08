import "server-only";

import { createHmac } from "node:crypto";

import sharp from "sharp";

import { env } from "~/env";
import { db } from "~/server/db";
import { OPC_SHARP } from "~/server/derivados";
import { CACHE_MOSTRAR, deleteS3Objects, getS3ObjectBytes, portfolioPhotoKey, putS3Object } from "~/server/s3";

/**
 * La versión de portfolio de cada foto: 1600px, sin marca de agua.
 *
 * Sólo se hace para las fotos que alguien puso en un portfolio, no para las
 * doce mil del bucket. Sale de la vista previa limpia (2400px), no del
 * original: ya está achicada y orientada, y bajarla cuesta un tercio.
 *
 * Es estado derivado, así que tiene su consulta de "a cuáles les falta"
 * (pendientes) y algo que la corre: la pasada que empuja quien agrega fotos,
 * más una cada pocos minutos por si el proceso murió en el medio. Una foto
 * cuya limpia todavía no existe (recién subida) se saltea y la toma una
 * pasada siguiente.
 */

export const PORTFOLIO_ANCHO = 1600;
export const PORTFOLIO_CALIDAD = 82;
const CADA_MS = 5 * 60_000;
const POR_PASADA = 60;
const EN_PARALELO = 4;

/**
 * El token de la clave: un HMAC del id con el secreto de la app. Siempre el
 * mismo para la misma foto —si dos pasadas la hacen a la vez escriben el mismo
 * archivo, no dos— y nadie puede calcularlo desde afuera.
 */
function tokenDe(photoId: string): string {
  return createHmac("sha256", env.AUTH_SECRET ?? "sin-secreto")
    .update(`portfolio:${photoId}`)
    .digest("hex")
    .slice(0, 20);
}

/** Las fotos que están en un portfolio y todavía no tienen su versión. */
async function pendientes(limite: number, soloPortfolio?: string) {
  return db.photo.findMany({
    where: {
      portfolioKey: null,
      deletedAt: null,
      previewCleanKey: { not: null },
      enPortfolios: { some: soloPortfolio ? { portfolioId: soloPortfolio } : {} },
    },
    select: { id: true, ownerId: true, previewCleanKey: true },
    take: limite,
  });
}

async function generar(f: { id: string; ownerId: string; previewCleanKey: string | null }): Promise<boolean> {
  if (!f.previewCleanKey) return false;
  try {
    const limpia = await getS3ObjectBytes(f.previewCleanKey);
    const salida = await sharp(limpia, OPC_SHARP)
      .resize({ width: PORTFOLIO_ANCHO, withoutEnlargement: true })
      .webp({ quality: PORTFOLIO_CALIDAD })
      .toBuffer();
    const clave = portfolioPhotoKey(f.ownerId, f.id, tokenDe(f.id));
    await putS3Object(clave, salida, "image/webp", CACHE_MOSTRAR);
    // Sólo si sigue en null: si mientras tanto la hizo otra pasada, igual es
    // la misma clave (el token es determinístico) y no hay nada que pisar.
    await db.photo.updateMany({ where: { id: f.id, portfolioKey: null }, data: { portfolioKey: clave } });
    return true;
  } catch (e) {
    console.error("[portfolio-fotos] no se pudo generar", f.id, e);
    return false;
  }
}

let corriendo: Promise<number> | null = null;

/**
 * Una pasada: hasta POR_PASADA fotos, de a EN_PARALELO. Si ya hay una en
 * curso devuelve esa en vez de lanzar otra (una sola por proceso).
 */
export function pasadaPortfolio(soloPortfolio?: string): Promise<number> {
  corriendo ??= (async () => {
    try {
      const lista = await pendientes(POR_PASADA, soloPortfolio);
      let hechas = 0;
      for (let i = 0; i < lista.length; i += EN_PARALELO) {
        const tanda = await Promise.all(lista.slice(i, i + EN_PARALELO).map(generar));
        hechas += tanda.filter(Boolean).length;
      }
      return hechas;
    } finally {
      corriendo = null;
    }
  })();
  return corriendo;
}

/**
 * Para quien acaba de agregar fotos: arranca una pasada sin esperarla. Si el
 * proceso muere a la mitad, la pasada periódica retoma lo que quedó.
 */
export function empujarPortfolio(): void {
  pasadaPortfolio().catch((e: unknown) => console.error("[portfolio-fotos] pasada:", e));
}

/** Cuántas fotos de un portfolio todavía no tienen su versión. */
export function faltanVersiones(portfolioId: string): Promise<number> {
  return db.portfolioFoto.count({
    where: { portfolioId, photo: { portfolioKey: null, deletedAt: null } },
  });
}

let arrancado = false;

export function arrancarPortfolioFotos(): void {
  if (arrancado || !env.PROCESADOR_ACTIVO) return;
  arrancado = true;
  const t = setInterval(empujarPortfolio, CADA_MS);
  t.unref?.();
}

/** Al sacar fotos de todos los portfolios, su versión ya no hace falta. */
export async function borrarVersionesHuerfanas(photoIds: string[]): Promise<void> {
  if (photoIds.length === 0) return;
  const sueltas = await db.photo.findMany({
    where: { id: { in: photoIds }, portfolioKey: { not: null }, enPortfolios: { none: {} } },
    select: { id: true, portfolioKey: true },
  });
  if (sueltas.length === 0) return;
  await db.photo.updateMany({ where: { id: { in: sueltas.map((s) => s.id) } }, data: { portfolioKey: null } });
  await deleteS3Objects(sueltas.map((s) => s.portfolioKey!)).catch((e: unknown) =>
    console.error("[portfolio-fotos] no se pudieron borrar", e),
  );
}
