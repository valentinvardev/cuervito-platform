import type { CSSProperties } from "react";

/**
 * El barrido: en la tienda, la foto borrosa con una banda diagonal nítida.
 *
 * Sin "server-only" a propósito: lo lee la tienda, la pantalla del evento en
 * el panel y la acción que lo guarda, y los tres tienen que conocer los mismos
 * nombres. Dos listas del mismo dato terminan distintas.
 *
 * Para el fotógrafo es un interruptor, prendido o apagado, en Mi página para
 * todos sus eventos (User.storefrontSweep) y en Precio de cada evento
 * (Event.sweep) para ese evento. Prendido es «todo»: la grilla y la foto
 * grande. «visor» (sólo la foto grande) la tienda lo entiende y queda como
 * grado intermedio, pero hoy ningún interruptor lo escribe.
 */
export const MODOS_BARRIDO = ["apagado", "visor", "todo"] as const;
export type ModoBarrido = (typeof MODOS_BARRIDO)[number];

/** El modo que escribe un interruptor: prendido o apagado. */
export const BARRIDO_PRENDIDO: ModoBarrido = "todo";
export const BARRIDO_APAGADO: ModoBarrido = "apagado";

export function esModoBarrido(v: unknown): v is ModoBarrido {
  return typeof v === "string" && (MODOS_BARRIDO as readonly string[]).includes(v);
}

/** Lo que rige para un evento: lo suyo o, si no dijo nada, lo del fotógrafo. */
export function barridoDe(evento: string | null | undefined, fotografo: boolean): ModoBarrido {
  if (esModoBarrido(evento)) return evento;
  return fotografo ? BARRIDO_PRENDIDO : BARRIDO_APAGADO;
}

/**
 * Las variables que necesita el CSS del barrido en una foto de la grilla: la
 * imagen (para la copia nítida), dónde cae la banda y cómo se encuadra. La
 * fase sale del índice y no del azar para que no cambie en cada render.
 */
export function varsBarrido(previewUrl: string, indice: number, posicion: "center" | "top"): CSSProperties {
  return {
    "--foto": `url("${previewUrl}")`,
    "--fase": `${30 + ((indice * 37) % 41)}%`,
    "--foto-pos": posicion,
  } as CSSProperties;
}
