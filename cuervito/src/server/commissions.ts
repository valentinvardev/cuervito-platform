import "server-only";

import { db } from "~/server/db";

/**
 * Devenga las comisiones de los colaboradores para una venta recién pagada.
 *
 * Base de cálculo: `sellerNetCents`, es decir lo que queda después de la
 * comisión de la plataforma. El colaborador cobra un % de lo que el dueño
 * efectivamente recibe, no del bruto — así la plataforma cobra primero y
 * el reparto entre fotógrafos sale del resto.
 *
 * Scopes:
 *   NONE → no cobra nada.
 *   ALL  → pct sobre todo el neto de la venta.
 *   OWN  → pct sobre la parte del neto correspondiente a las fotos que ese
 *          colaborador subió. Se prorratea por el precio de cada ítem, no
 *          por cantidad, para que una foto más cara pese más.
 *
 * Idempotente: el unique (saleId, userId) más `skipDuplicates` hacen que
 * reintentos del webhook no dupliquen. Es fundamental — Mercado Pago
 * reenvía notificaciones.
 *
 * NO mueve dinero. Deja registrado cuánto le debe el dueño al colaborador.
 */
export async function accrueCommissionsForSale(saleId: string): Promise<void> {
  const sale = await db.sale.findUnique({
    where: { id: saleId },
    select: {
      id: true,
      eventId: true,
      sellerNetCents: true,
      status: true,
      items: {
        select: {
          priceCents: true,
          photo: { select: { uploadedById: true } },
        },
      },
    },
  });
  if (!sale || sale.status !== "PAID" || sale.sellerNetCents <= 0) return;

  const collaborators = await db.eventCollaborator.findMany({
    where: {
      eventId: sale.eventId,
      status: "ACCEPTED",
      userId: { not: null },
      commissionScope: { not: "NONE" },
      commissionPct: { gt: 0 },
    },
    select: { userId: true, commissionScope: true, commissionPct: true },
  });
  if (collaborators.length === 0) return;

  // Cuánto del neto corresponde a las fotos de cada uploader.
  const itemsTotal = sale.items.reduce((a, i) => a + i.priceCents, 0);
  const netByUploader = new Map<string, number>();
  if (itemsTotal > 0) {
    for (const item of sale.items) {
      const uploader = item.photo?.uploadedById;
      if (!uploader) continue;
      const share = Math.round(
        (item.priceCents / itemsTotal) * sale.sellerNetCents,
      );
      netByUploader.set(uploader, (netByUploader.get(uploader) ?? 0) + share);
    }
  }

  const rows: {
    saleId: string;
    userId: string;
    scope: "OWN" | "ALL";
    pct: number;
    amountCents: number;
  }[] = [];

  for (const c of collaborators) {
    if (!c.userId) continue;
    const base =
      c.commissionScope === "ALL"
        ? sale.sellerNetCents
        : (netByUploader.get(c.userId) ?? 0);
    if (base <= 0) continue;

    const amountCents = Math.round((base * c.commissionPct) / 100);
    if (amountCents <= 0) continue;

    rows.push({
      saleId: sale.id,
      userId: c.userId,
      scope: c.commissionScope as "OWN" | "ALL",
      pct: c.commissionPct,
      amountCents,
    });
  }

  if (rows.length === 0) return;

  // Guardia: la suma de comisiones nunca puede superar el neto del dueño.
  // Con varios colaboradores en scope ALL los porcentajes podrían sumar
  // más de 100 — en ese caso no escribimos nada y avisamos, porque
  // repartir de más sería peor que no repartir.
  const total = rows.reduce((a, r) => a + r.amountCents, 0);
  if (total > sale.sellerNetCents) {
    console.error(
      `[commissions] saleId=${sale.id}: las comisiones (${total}) superan el neto (${sale.sellerNetCents}). No se registró nada — revisar los porcentajes de los colaboradores del evento ${sale.eventId}.`,
    );
    return;
  }

  await db.saleCommission.createMany({ data: rows, skipDuplicates: true });
}
