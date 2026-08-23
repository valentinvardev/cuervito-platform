import { NextResponse } from "next/server";
import { z } from "zod";

import { calcular } from "~/lib/descuentos";
import { db } from "~/server/db";

/**
 * Cuánto queda el carrito, antes de ir a pagar.
 *
 * Existe por una razón: el código de descuento NO puede validarse en el
 * navegador. Para hacerlo ahí habría que mandarle la lista de códigos del
 * evento, y un código que viaja en el HTML de la página de venta lo lee
 * cualquiera con las herramientas de desarrollo. Un código existe para
 * repartirlo aparte —al club, a los que corrieron el año pasado—; publicado en
 * la misma página deja de ser un código.
 *
 * Así que el navegador manda el texto y el servidor contesta cuánto descuenta,
 * sin decir nunca qué otros códigos hay.
 *
 * Devuelve la cuenta COMPLETA y no sólo el descuento del código: el subtotal
 * depende de los precios por foto, que pueden estar pisados foto por foto, y
 * los automáticos dependen de la cantidad. Calculando todo acá, el número del
 * carrito es exactamente el que va a cobrar el checkout.
 *
 * No crea nada ni consume el cupón: eso pasa recién al pagar.
 */
const esquema = z.object({
  eventId: z.string().min(1),
  photoIds: z.array(z.string().min(1)).min(1).max(200),
  code: z.string().trim().max(30).optional(),
});

export async function POST(req: Request) {
  const parsed = esquema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const { eventId, photoIds, code } = parsed.data;

  const evento = await db.event.findUnique({
    where: { id: eventId },
    select: { id: true, isPublished: true, status: true, pricePerPhoto: true },
  });
  if (!evento?.isPublished || evento.status === "ARCHIVED") {
    return NextResponse.json({ error: "Evento no disponible." }, { status: 404 });
  }

  // El precio sale de la base y no de lo que mande el navegador: si viniera del
  // cliente, el descuento se podría fabricar mandando un subtotal inflado.
  const fotos = await db.photo.findMany({
    where: { id: { in: photoIds }, eventId, deletedAt: null },
    select: { id: true, priceOverride: true },
  });
  if (fotos.length === 0) {
    return NextResponse.json({ error: "No hay fotos en el carrito." }, { status: 400 });
  }

  const precioEvento = Math.round(Number(evento.pricePerPhoto) * 100);
  const subtotalCentavos = fotos.reduce(
    (a, f) => a + (f.priceOverride ? Math.round(Number(f.priceOverride) * 100) : precioEvento),
    0,
  );

  const descuentos = await db.discount.findMany({
    where: { eventId, OR: [{ expires: null }, { expires: { gt: new Date() } }] },
    select: {
      id: true, type: true, code: true, kind: true, value: true,
      qty: true, price: true, expires: true, maxUses: true, usageCount: true,
    },
  });

  const { aplicado, totalCentavos } = calcular({
    descuentos: descuentos.map((d) => ({
      ...d,
      value: d.value === null ? null : Number(d.value),
      price: d.price === null ? null : Number(d.price),
    })),
    subtotalCentavos,
    cantidad: fotos.length,
    codigo: code,
  });

  // Que el código no sirva NO es un error del pedido: es una respuesta
  // legítima que el carrito tiene que poder mostrar sin tratarla como falla.
  const codigoInvalido = !!code?.trim() && !aplicado;

  return NextResponse.json({
    subtotalCentavos,
    descuentoCentavos: aplicado?.centavos ?? 0,
    totalCentavos,
    texto: aplicado?.texto ?? null,
    codigoInvalido,
  });
}
