import "server-only";

import { notFound } from "next/navigation";

import { puedeUsarPortfolio } from "~/lib/portfolio-acceso";
import { auth } from "~/server/auth";
import { db } from "~/server/db";

import { sesionPanel } from "../_components/sesion";

/**
 * El control de acceso de las pantallas de Portfolio. Para quien no puede
 * usarlo, la sección no existe (404), igual que el ítem no aparece en el riel.
 */
export async function sesionPortfolio() {
  const s = await sesionPanel();
  if (!puedeUsarPortfolio(s.rol)) notFound();
  return s;
}

/** Lo mismo para las acciones: el id del usuario, o null si no puede. */
export async function usuarioPortfolio(): Promise<string | null> {
  const s = await auth();
  if (!s?.user?.id || !puedeUsarPortfolio(s.user.role)) return null;
  return s.user.id;
}

/** Un portfolio del usuario, o 404. Toda pantalla de un portfolio pasa por acá. */
export async function portfolioPropio(userId: string, id: string) {
  const p = await db.portfolio.findFirst({ where: { id, ownerId: userId } });
  if (!p) notFound();
  return p;
}
