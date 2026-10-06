import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "~/env";

import { BASE } from "./diseno";

/**
 * Las imágenes que llevan los mails: las fotos de una compra, las miniaturas
 * de una venta, la portada de un evento.
 *
 * Pasan por /api/correos/imagen y no van directo a la CDN por tres razones de
 * cliente de correo, no de gusto: Outlook no muestra WebP, que es como se
 * guardan las vistas previas; Gmail ignora object-fit, así que la imagen tiene
 * que llegar ya recortada a la forma de su casillero; y la vista previa entera
 * pesa 800 KB para mostrarse a 160 px. La ruta las recorta a medida, en JPEG,
 * al doble del tamaño en que se ven.
 *
 * Sin sesión, porque el mail se abre donde sea. La firma —el mismo HMAC que la
 * baja— es lo que impide pedir la foto de otro cambiando un id: sólo existen
 * los links que armó el servidor al mandar el mail.
 */

export type TipoImagen = "foto" | "portada";

/** Las formas, en píxeles reales (el doble de como se ven en el mail). */
export const FORMAS = {
  /** La foto sola de una entrega de una foto, de borde a borde. */
  ancha: [1120, 630],
  /** La grande del mosaico, cuadrada. */
  grande: [660, 660],
  /** Las dos chicas del mosaico, una arriba de la otra. */
  media: [452, 326],
  /** Dos fotos lado a lado. */
  par: [556, 556],
  /** Las miniaturas de una venta. */
  mini: [192, 192],
  /** La portada del evento en la invitación. */
  portada: [1120, 560],
} as const satisfies Record<string, readonly [number, number]>;
export type Forma = keyof typeof FORMAS;

function firmar(tipo: TipoImagen, id: string, forma: Forma): string {
  return createHmac("sha256", String(env.AUTH_SECRET ?? "sin-secreto"))
    .update(`imagen:${tipo}:${id}:${forma}`)
    .digest("hex")
    .slice(0, 32);
}

export function verificarImagen(tipo: TipoImagen, id: string, forma: Forma, firma: string): boolean {
  const esperada = Buffer.from(firmar(tipo, id, forma));
  const dada = Buffer.from(firma);
  return esperada.length === dada.length && timingSafeEqual(esperada, dada);
}

export function imagenUrl(tipo: TipoImagen, id: string, forma: Forma): string {
  return `${BASE}/api/correos/imagen/${tipo}/${encodeURIComponent(id)}/${forma}/${firmar(tipo, id, forma)}.jpg`;
}

export function esForma(f: string): f is Forma {
  return f in FORMAS;
}
