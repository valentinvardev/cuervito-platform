import type { CSSProperties } from "react";

/**
 * El barrido: en la tienda, la foto borrosa con una banda diagonal nítida.
 *
 * Sin "server-only" a propósito: lo lee la tienda, la pantalla del evento en
 * el panel y la acción que lo guarda, y los tres tienen que conocer los mismos
 * nombres. Dos listas del mismo dato terminan distintas.
 *
 * Se decide por evento (Event.sweep). Si el evento no dice nada, rige lo que
 * el fotógrafo puso en Mi página (User.storefrontSweep), que es sólo prendido
 * o apagado para la foto grande.
 */
export const MODOS_BARRIDO = ["apagado", "visor", "todo"] as const;
export type ModoBarrido = (typeof MODOS_BARRIDO)[number];

/** Lo que elige el fotógrafo en Info del evento: los tres modos, o heredar. */
export const HEREDAR = "heredar";

export const MODOS_BARRIDO_LISTA: { id: ModoBarrido; nombre: string; detalle: string }[] = [
  { id: "apagado", nombre: "Apagado", detalle: "Sólo la marca de agua." },
  {
    id: "visor",
    nombre: "En la foto grande",
    detalle: "Al abrir una foto se ve borrosa y una banda nítida la recorre. La grilla queda igual.",
  },
  {
    id: "todo",
    nombre: "En la grilla y en la foto grande",
    detalle: "También cada foto de la grilla, con una banda fija. Cuesta más reconocerse mirando.",
  },
];

export function esModoBarrido(v: unknown): v is ModoBarrido {
  return typeof v === "string" && (MODOS_BARRIDO as readonly string[]).includes(v);
}

/** Lo que rige para un evento: lo suyo o, si no dijo nada, lo del fotógrafo. */
export function barridoDe(evento: string | null | undefined, fotografo: boolean): ModoBarrido {
  if (esModoBarrido(evento)) return evento;
  return fotografo ? "visor" : "apagado";
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
