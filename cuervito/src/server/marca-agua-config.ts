import { z } from "zod";

/**
 * La forma de la configuración de la marca de agua.
 *
 * Vive en un archivo sin "server-only" a propósito, como los formatos de las
 * historias: el editor del admin corre en el navegador y necesita los mismos
 * nombres, límites y valores por defecto que el servidor. Dos listas —una acá
 * y otra en el cliente— se separan el día que alguien agrega un patrón en una
 * sola.
 */

export const PATRONES = ["mosaico", "diagonal", "centro", "esquina"] as const;
export type Patron = (typeof PATRONES)[number];

export const PATRONES_LISTA: { id: Patron; nombre: string; descripcion: string }[] = [
  { id: "mosaico", nombre: "Mosaico", descripcion: "Filas corridas, cada unidad rotada. Cubre todo." },
  { id: "diagonal", nombre: "Diagonal", descripcion: "Hileras inclinadas, la unidad derecha." },
  { id: "centro", nombre: "Centro", descripcion: "Una sola unidad, grande, en el medio." },
  { id: "esquina", nombre: "Esquina", descripcion: "Una sola, abajo a la derecha. Firma, no protección." },
];

/**
 * La filigrana: una línea de texto fina, a baja opacidad, repetida en filas
 * por TODA la foto.
 *
 * Es otra capa, aparte de la unidad y el patrón: va debajo de la marca, dice
 * otra cosa —el evento y el fotógrafo, foto por foto— y no entra en la
 * miniatura, donde a 560 píxeles sería una mancha. Lo que cuesta sacar con el
 * pincel de un editor no es el logo del medio, que se tapa de un trazo: son
 * cientos de letras finas cruzando caras, remeras y fondo.
 */
export const esquemaFiligrana = z.object({
  activa: z.boolean(),
  /** "evento": «<evento> · <fotógrafo> · encontrate.app», distinto en cada
      foto. "fijo": lo que diga `texto`. */
  modo: z.enum(["evento", "fijo"]),
  texto: z.string().max(80),
  /** Alto de la letra como fracción del ancho de la foto: 0.016 son 38 px en
      una vista previa de 2400. */
  escala: z.number().min(0.008).max(0.05),
  opacidad: z.number().min(0.03).max(0.6),
  /** Grados: rota la trama entera, como el patrón diagonal. */
  rotacion: z.number().min(-60).max(60),
  /** Aire entre filas, en altos de letra. */
  separacion: z.number().min(1).max(6),
});
export type ConfigFiligrana = z.infer<typeof esquemaFiligrana>;

export const FILIGRANA_POR_DEFECTO: ConfigFiligrana = {
  activa: false,
  modo: "evento",
  texto: "",
  escala: 0.016,
  opacidad: 0.22,
  rotacion: -20,
  separacion: 2.5,
};

export const esquemaConfig = z.object({
  /** Qué imagen lleva la unidad: el PNG subido (si hay) o el logo de encontrate. */
  fuente: z.enum(["subida", "logo"]),
  patron: z.enum(PATRONES),
  /** Ancho de la unidad como fracción del ancho de la foto. */
  escala: z.number().min(0.05).max(0.7),
  opacidad: z.number().min(0.05).max(1),
  /** Grados. En mosaico rota cada unidad; en diagonal rota la trama entera. */
  rotacion: z.number().min(-90).max(90),
  /** Aire entre unidades, como fracción del ancho de la unidad. */
  separacion: z.number().min(0).max(4),
  /** Para "esquina": distancia al borde como fracción del ancho de la foto. */
  margen: z.number().min(0).max(0.3),
  /** Texto debajo de la imagen. Vacío = sin texto. */
  texto: z.string().max(60),
  /** Tamaño del texto como fracción del ancho de la unidad. */
  textoEscala: z.number().min(0.05).max(0.5),
  color: z.enum(["blanco", "tinta"]),
  /** Con valor por defecto: las configuraciones guardadas antes no la traen,
      y tienen que seguir leyéndose, con la filigrana apagada. */
  filigrana: esquemaFiligrana.default(FILIGRANA_POR_DEFECTO),
});
export type ConfigMarca = z.infer<typeof esquemaConfig>;

export const CONFIG_POR_DEFECTO: ConfigMarca = {
  fuente: "subida",
  patron: "diagonal",
  escala: 0.22,
  opacidad: 0.55,
  rotacion: -30,
  separacion: 0.9,
  margen: 0.04,
  texto: "",
  textoEscala: 0.16,
  color: "blanco",
  filigrana: FILIGRANA_POR_DEFECTO,
};

/**
 * Qué dice la filigrana de esta foto, o null si no lleva.
 *
 * `conPlataforma` va en false para la marca propia de un fotógrafo: su evento
 * y su nombre, sin «encontrate.app» al final, por la misma regla que su logo
 * va sin el texto de la plataforma debajo.
 */
export function textoFiligrana(
  cfg: ConfigMarca,
  foto: { evento: string | null; fotografo: string | null; conPlataforma: boolean },
): string | null {
  const f = cfg.filigrana;
  if (!f.activa) return null;
  if (f.modo === "fijo") return f.texto.trim() || null;
  const partes = [foto.evento?.trim(), foto.fotografo?.trim(), foto.conPlataforma ? "encontrate.app" : null].filter(
    (p): p is string => Boolean(p),
  );
  return partes.length ? partes.join("  ·  ") : null;
}
