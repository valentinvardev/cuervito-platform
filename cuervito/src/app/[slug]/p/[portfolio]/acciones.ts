"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import { z } from "zod";

import { avisarConsulta } from "~/server/correos/consulta-portfolio";
import { db } from "~/server/db";
import { clientIp, hitRateLimit } from "~/server/rate-limit";

const consultaSchema = z.object({
  // Sin saltos de línea: el nombre va al asunto del mail.
  name: z.string().trim().min(1).max(80).regex(/^[^\r\n]*$/),
  email: z.string().trim().toLowerCase().email().max(160),
  message: z.string().trim().min(1).max(4000),
});

/** Tope por portfolio y por día: el formulario es público y manda un mail. */
const TOPE_DIARIO = 40;

/**
 * El formulario de contacto de un portfolio publicado. La plantilla lo llama
 * con lo que escribió el visitante; si algo falla, tira, y la plantilla
 * muestra "no se pudo mandar".
 *
 * Va atado al portfolio con .bind() desde la página, así que el id no lo
 * elige el visitante. Igual se verifica que esté publicado.
 */
export async function consultarPortfolio(
  portfolioId: string,
  datos: { name: string; email: string; message: string },
): Promise<void> {
  const d = consultaSchema.parse(datos);

  const ip = clientIp(await headers());
  const limite = hitRateLimit(`consulta-portfolio:${ip}`, [
    { limit: 3, windowMs: 10 * 60_000 },
    { limit: 10, windowMs: 24 * 60 * 60_000 },
  ]);
  if (!limite.ok) throw new Error("demasiadas consultas");

  const p = await db.portfolio.findFirst({
    where: { id: portfolioId, publicadoAt: { not: null } },
    select: { id: true },
  });
  if (!p) throw new Error("portfolio no disponible");

  const desde = new Date(Date.now() - 24 * 60 * 60_000);
  const hoy = await db.consultaPortfolio.count({ where: { portfolioId, createdAt: { gte: desde } } });
  if (hoy >= TOPE_DIARIO) throw new Error("tope diario");

  const c = await db.consultaPortfolio.create({
    data: { portfolioId, nombre: d.name, email: d.email, mensaje: d.message },
    select: { id: true },
  });

  // El mail, después de responder: la consulta ya está guardada y el
  // visitante no tiene por qué esperar al proveedor de correo.
  after(() => avisarConsulta(c.id).catch((e: unknown) => console.error("[portfolio] aviso de consulta:", e)));
}
