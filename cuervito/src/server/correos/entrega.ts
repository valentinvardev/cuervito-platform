import "server-only";

import { usuarioInstagram } from "~/lib/instagram";
import { db } from "~/server/db";
import { deliveryEmailHtml } from "~/server/email-encontrate";

import { BASE } from "./diseno";

/**
 * El mail de entrega de una venta, listo para mandar.
 *
 * Lo mandan tres lugares —el webhook de Mercado Pago, el checkout cuando no
 * hay nada que cobrar, y el "reenviar" del panel— y antes cada uno armaba su
 * consulta y sus datos. Así el de reenviar mandaba el vencimiento y los otros
 * dos no, y el "Hola" de relleno terminaba en "Listo, Hola". Una sola función
 * es un solo mail.
 *
 * Null si la venta no tiene link de descarga todavía: no hay nada que mandar.
 */
export async function mailDeEntrega(
  saleId: string,
): Promise<{ to: string; subject: string; html: string } | null> {
  const sale = await db.sale.findUnique({
    where: { id: saleId },
    select: {
      buyerEmail: true,
      buyerName: true,
      downloadToken: true,
      downloadTokenExpires: true,
      event: { select: { name: true, eventDate: true } },
      seller: { select: { name: true, instagramUrl: true } },
      _count: { select: { items: true } },
      // Hasta tres, para el mosaico de arriba. Las borradas no: su imagen ya
      // no se sirve, y el mosaico quedaría con un hueco.
      items: {
        where: { photo: { deletedAt: null } },
        select: { photoId: true },
        take: 3,
      },
    },
  });
  if (!sale?.downloadToken) return null;

  return {
    to: sale.buyerEmail,
    subject: `Tus fotos · ${sale.event.name}`,
    html: deliveryEmailHtml({
      buyerName: sale.buyerName,
      eventName: sale.event.name,
      photoCount: sale._count.items,
      downloadUrl: `${BASE}/descarga/${sale.downloadToken}`,
      expiresAt: sale.downloadTokenExpires,
      fotos: sale.items.flatMap((i) => (i.photoId ? [i.photoId] : [])),
      fechaEvento: sale.event.eventDate,
      fotografo: sale.seller.name
        ? { nombre: sale.seller.name, instagram: usuarioInstagram(sale.seller.instagramUrl) }
        : null,
    }),
  };
}
