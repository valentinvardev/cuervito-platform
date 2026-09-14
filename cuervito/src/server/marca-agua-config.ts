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
};
