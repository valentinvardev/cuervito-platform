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

/** Un punto de la foto, en fracciones: {0.5, 0.5} es el centro. */
export type Foco = { x: number; y: number };

/** Dónde va la foto dentro de la pieza, en píxeles del formato. */
export type CajaFoto = { left: number; top: number; ancho: number; alto: number; radio: number };

/**
 * La caja de la foto, en píxeles del formato.
 *
 * La pantalla la necesita para saber sobre qué parte de la vista previa se
 * arrastra, y el render la necesita para saber dónde pegar la foto. Si cada
 * uno tuviera su copia de estos números, la primera vez que se retoque el
 * margen en uno solo el arrastre y el resultado dejarían de coincidir.
 */
export function cajaFoto(plantilla: PlantillaId, formato: FormatoId): CajaFoto {
  const { ancho, alto } = FORMATOS[formato];
  if (plantilla === "cubierta") return { left: 0, top: 0, ancho, alto, radio: 0 };

  // La foto ocupa el ancho menos los márgenes y deja abajo el alto que el
  // texto necesita. Se calcula sobre el alto total y no con un número fijo
  // porque el posteo es 570px más bajo que la historia: con una caja fija,
  // en 4:5 el texto quedaba encima de la foto.
  const margen = Math.round(ancho * (formato === "historia" ? 0.072 : 0.057));
  return {
    left: margen,
    top: margen,
    ancho: ancho - margen * 2,
    alto: Math.round(alto * (formato === "historia" ? 0.58 : 0.5)),
    radio: Math.round(ancho * 0.028),
  };
}
