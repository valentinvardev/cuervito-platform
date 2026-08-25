import "server-only";

/**
 * Cronómetro para las partes lentas.
 *
 * Existe porque el panel y la tienda se pusieron lentos y ya se corrigieron
 * dos cosas por lectura del código sin que ninguna lo resolviera. Adivinar una
 * tercera vez cuesta otro deploy y otra vuelta; medir cuesta dos líneas.
 *
 * La forma es `const t = ahora()` … `lento("etiqueta", t)` y no un envoltorio
 * que reciba la función, a propósito: envolver obliga a reindentar el bloque
 * medido, y entonces el cambio de una línea se vuelve un diff de cien y no se
 * puede revisar.
 *
 * Sólo escribe cuando algo pasa el umbral, y esa es la gracia: en
 * funcionamiento normal no dice nada, así que puede quedarse puesto. El
 * silencio también es una respuesta —si la pantalla se siente lenta y acá no
 * sale nada, el tiempo no se va en el servidor—.
 *
 * Se lee con:  pm2 logs cuervito --nostream | grep lento
 */

/** Arriba de esto se considera que algo tardó. */
const UMBRAL_MS = Number(process.env.UMBRAL_LENTO_MS ?? 200);

export function ahora(): number {
  return performance.now();
}

export function lento(etiqueta: string, desde: number): void {
  const ms = Math.round(performance.now() - desde);
  if (ms >= UMBRAL_MS) {
    // El número primero y con ancho fijo, para poder ordenar la salida.
    console.log(`[lento] ${String(ms).padStart(6)}ms  ${etiqueta}`);
  }
}
