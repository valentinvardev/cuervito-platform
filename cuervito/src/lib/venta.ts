/**
 * Qué significa cada estado de una venta, en un solo lugar.
 *
 * Existe por una pregunta que se hacía en seis archivos con la misma línea
 * copiada —`if (sale.status !== "PAID")`—: la página de entrega, las tres
 * rutas de descarga, el reenvío del mail y el sondeo de estado. Mientras el
 * único estado entregable fuera PAID eso funcionaba; al aparecer GIFT, cada
 * una de esas seis copias se convierte en un comprador que abre su link y lee
 * "el pago todavía no fue confirmado" por unas fotos que le regalaron.
 *
 * Así que la pregunta deja de ser "¿está pagada?" y pasa a ser "¿tiene derecho
 * a las fotos?", que es lo que esas seis líneas querían preguntar desde el
 * principio. La diferencia importa: la contabilidad sí quiere PAID a secas, y
 * por eso los dos filtros no pueden ser el mismo.
 *
 * Módulo puro a propósito: no importa Prisma ni nada del servidor, para que lo
 * pueda usar también el navegador al dibujar el estado de una venta.
 */

export type EstadoVenta =
  | "PENDING"
  | "PAID"
  | "FAILED"
  | "REFUNDED"
  | "EXPIRED"
  | "GIFT";

/**
 * ¿El comprador puede bajar sus fotos?
 *
 * PAID porque pagó. GIFT porque se las regalaron. Ningún otro: PENDING todavía
 * no confirmó, y FAILED, REFUNDED y EXPIRED ya no tienen derecho.
 */
export function esEntregable(estado: string): boolean {
  return estado === "PAID" || estado === "GIFT";
}

/** ¿Esta venta movió plata? Es la pregunta de la contabilidad, no la de la
 *  entrega: un regalo se entrega pero no factura. */
export function esCobrada(estado: string): boolean {
  return estado === "PAID";
}
