import Link from "next/link";
import { ReceiptText } from "lucide-react";

import { db } from "~/server/db";

import { hace, pesos, sesionPanel } from "../_components/sesion";
import { Lista } from "./_lista";

export const dynamic = "force-dynamic";

/** La ventana del resumen de arriba: cuánto ganó "últimamente". */
const DIAS = 30;
/** Cuántas ventas por página. */
const TANDA = 50;

/* Los campos de una fila. Es la misma forma para la lista y para la venta que
   se abre de entrada, así que está una sola vez. */
const FILA = {
  id: true,
  buyerName: true,
  buyerEmail: true,
  subtotalCents: true,
  discountCents: true,
  totalCents: true,
  sellerNetCents: true,
  status: true,
  createdAt: true,
  paidAt: true,
  // Para el cajón. Viajan con la lista porque son cuatro campos de la misma
  // fila: lo caro del detalle son las miniaturas, y ésas sí se piden recién
  // al abrir.
  downloadToken: true,
  downloadTokenExpires: true,
  downloadCount: true,
  event: { select: { name: true } },
  _count: { select: { items: true } },
} as const;

/**
 * Las ventas, todas, de a cincuenta.
 *
 * Esto mostraba las últimas cincuenta de los últimos treinta días, y nada
 * más: sin "ver más", sin fechas, sin nada. Medido contra un fotógrafo real:
 * 409 ventas, 140 en el mes; la lista llegaba hasta hace dieciséis días y
 * arriba decía "140 ventas". Las otras 359 no existían desde el panel. Y la
 * venta que hay que buscar es siempre una vieja: es la del que escribe dos
 * meses después diciendo que no le llegaron las fotos.
 *
 * Se pagina por cursor —la última venta de la página, en (fecha, id)— y no
 * por número de página. Con número, una venta que entra mientras se está
 * mirando la página dos corre todo un lugar y la última de la dos aparece
 * repetida al principio de la tres. Con cursor, "las anteriores a ésta" es
 * siempre el mismo conjunto.
 *
 *   ?antes=<id>   la página que sigue a esa venta
 *   ?venta=<id>   una venta puntual, abierta de entrada; es a donde llega el
 *                 buscador, y se trae aparte para que aparezca aunque sea más
 *                 vieja que la página que se muestra
 */
export default async function V2Ventas(props: {
  searchParams: Promise<{ antes?: string; venta?: string }>;
}) {
  const { userId } = await sesionPanel();
  const { antes, venta: ventaPedida } = await props.searchParams;

  const desde = new Date(Date.now() - DIAS * 86400000);

  const [resumen, filas, fotos, puntual] = await Promise.all([
    db.sale.aggregate({
      _sum: { sellerNetCents: true },
      _count: true,
      where: { sellerId: userId, status: "PAID", paidAt: { gte: desde } },
    }),
    db.sale.findMany({
      where: { sellerId: userId },
      // El desempate por id no es adorno: dos ventas en el mismo segundo son
      // normales en una tanda de compras después de una carrera, y un cursor
      // que sólo mira la fecha las saltea o las repite justo ahí.
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      // Una de más: es la forma de saber si hay página siguiente sin contar
      // el total, que sería otra consulta para responder sí o no.
      take: TANDA + 1,
      ...(antes ? { cursor: { id: antes }, skip: 1 } : {}),
      select: FILA,
    }),
    db.saleItem.count({
      where: { sale: { sellerId: userId, status: "PAID", paidAt: { gte: desde } } },
    }),
    // Con el sellerId en el where: el id llega por la URL y no puede abrir la
    // venta de otro.
    ventaPedida
      ? db.sale.findFirst({ where: { id: ventaPedida, sellerId: userId }, select: FILA })
      : Promise.resolve(null),
  ]);

  const hayMas = filas.length > TANDA;
  const pagina = hayMas ? filas.slice(0, TANDA) : filas;
  // La pedida va primera si no está ya en la página. Si está, se abre donde
  // está: moverla sería cambiar el orden de la lista sin razón.
  const ventas =
    puntual && !pagina.some((v) => v.id === puntual.id) ? [puntual, ...pagina] : pagina;
  const cursorSiguiente = hayMas ? (pagina[pagina.length - 1]?.id ?? null) : null;

  const neto = resumen._sum.sellerNetCents ?? 0;

  return (
    <main className="canvas">
        <div className="canvas-in">
          <div className="head">
            <div>
              <h1>Ventas</h1>
              <p>
                {resumen._count} {resumen._count === 1 ? "venta" : "ventas"} en los últimos {DIAS} días.
              </p>
            </div>
          </div>

          {/* Una sola tarjeta con lo que ganó. La resta de la comisión no va
              acá: recordarle en cada pantalla cuánto se lleva la plataforma no
              lo ayuda a vender, y el número que le importa es el que le queda.
              El desglose vive en Métodos de pago. */}
          <section className="sum">
            <div className="card neto">
              <div className="k-lab">Ganaste en los últimos {DIAS} días</div>
              <div className="k-n tnum">{pesos(neto)}</div>
              <div className="k-sub">
                {resumen._count} ventas · {fotos.toLocaleString("es-AR")} fotos · ya en tu cuenta de
                Mercado Pago
              </div>
            </div>
          </section>

          <section className="card">
            {ventas.length > 0 ? (
              <Lista
                ventas={ventas.map((v) => ({
                  id: v.id,
                  quien: v.buyerName ?? v.buyerEmail,
                  mail: v.buyerEmail,
                  evento: v.event.name,
                  fotos: v._count.items,
                  subtotal: v.subtotalCents,
                  descuento: v.discountCents,
                  pago: v.totalCents,
                  neto: v.sellerNetCents,
                  estado: v.status,
                  fecha: (v.paidAt ?? v.createdAt).toISOString(),
                  hace: hace(v.createdAt),
                  descargas: v.downloadCount,
                  vence: v.downloadTokenExpires?.toISOString() ?? null,
                  token: v.downloadToken,
                }))}
                abrirId={puntual?.id}
              />
            ) : (
              <div className="empty">
                <div className="empty-i">
                  <ReceiptText />
                </div>
                <h3>No se encontraron ventas</h3>
                <p>
                  Pasale el link de tu evento al grupo del club o al organizador: es de donde vienen
                  casi todas las primeras ventas.
                </p>
                <Link href="/dashboard/eventos" className="btn btn-ghost">
                  Ver mis eventos
                </Link>
              </div>
            )}

            {/* Links y no botones: la página siguiente es una dirección, se
                puede guardar, mandar y abrir en otra pestaña. Y funciona sin
                que el JavaScript haya llegado. */}
            {(cursorSiguiente || antes) && (
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  justifyContent: "center",
                  padding: "16px 0 4px",
                  flexWrap: "wrap",
                }}
              >
                {antes && (
                  <Link href="/dashboard/ventas" className="btn btn-ghost">
                    Volver a las más recientes
                  </Link>
                )}
                {cursorSiguiente && (
                  <Link href={`/dashboard/ventas?antes=${cursorSiguiente}`} className="btn btn-ghost">
                    Ver ventas anteriores
                  </Link>
                )}
              </div>
            )}
          </section>
        </div>
      </main>
  );
}
