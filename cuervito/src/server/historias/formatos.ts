/**
 * Los formatos y las plantillas del estudio de historias.
 *
 * Vive en un archivo sin "server-only" a propósito: la pantalla del navegador
 * necesita los mismos nombres y las mismas proporciones para dibujar el
 * selector, y tener dos listas —una acá y otra en el cliente— termina el día
 * que alguien agrega un formato en una sola.
 */

export type FormatoId = "historia" | "post";

export type Formato = {
  id: FormatoId;
  nombre: string;
  /** Para la ayuda del selector. */
  donde: string;
  ancho: number;
  alto: number;
};

/**
 * Las medidas son las que pide Instagram, no las que quedan lindas.
 *
 * 1080 de ancho es el máximo que la plataforma sirve sin recomprimir: subir
 * más grande no mejora nada y sólo hace que Instagram lo baje con su propio
 * compresor, que es peor que el nuestro.
 */
export const FORMATOS: Record<FormatoId, Formato> = {
  historia: {
    id: "historia",
    nombre: "Historia",
    donde: "Stories y reels · 9:16",
    ancho: 1080,
    alto: 1920,
  },
  post: {
    id: "post",
    nombre: "Posteo",
    donde: "Feed · 4:5, el vertical que más ocupa",
    ancho: 1080,
    alto: 1350,
  },
};

export type PlantillaId = "cubierta" | "placa";

export type Plantilla = {
  id: PlantillaId;
  nombre: string;
  descripcion: string;
};

export const PLANTILLAS: Record<PlantillaId, Plantilla> = {
  cubierta: {
    id: "cubierta",
    nombre: "Foto a pantalla completa",
    descripcion: "La foto ocupa todo y el texto va abajo, sobre un degradado.",
  },
  placa: {
    id: "placa",
    nombre: "Placa con marco",
    descripcion: "La foto en una tarjeta, sobre el color de tu marca.",
  },
};

export const FORMATOS_LISTA = Object.values(FORMATOS);
export const PLANTILLAS_LISTA = Object.values(PLANTILLAS);
