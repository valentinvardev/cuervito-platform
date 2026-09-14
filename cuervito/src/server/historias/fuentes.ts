import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Las fuentes para satori.
 *
 * satori pide los archivos, no los nombres: corre fuera del navegador y no hay
 * CSS que resuelva nada. Van versionadas en el repo y no bajadas al vuelo
 * porque una historia que falla porque Google Fonts tardó no se puede
 * explicar.
 *
 * Las usan las historias y la marca de agua. Están en un módulo aparte para
 * que la marca de agua no tenga que importar el render de historias entero
 * —con sus plantillas en JSX— sólo para leer tres archivos.
 */
const CARPETA = path.join(process.cwd(), "src/server/historias/fuentes");

export type FuenteSatori = {
  name: string;
  data: Buffer;
  weight: 400 | 600 | 800;
  style: "normal";
};

let cache: FuenteSatori[] | null = null;

export async function fuentesSatori(): Promise<FuenteSatori[]> {
  cache ??= [
    { name: "Outfit", data: await readFile(path.join(CARPETA, "Outfit-400.ttf")), weight: 400, style: "normal" },
    { name: "Outfit", data: await readFile(path.join(CARPETA, "Outfit-600.ttf")), weight: 600, style: "normal" },
    { name: "Unbounded", data: await readFile(path.join(CARPETA, "Unbounded-800.ttf")), weight: 800, style: "normal" },
  ];
  return cache;
}
