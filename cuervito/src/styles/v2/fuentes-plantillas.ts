import {
  Archivo,
  Archivo_Black,
  Barlow,
  Barlow_Condensed,
  Geist,
  Inter,
  Manrope,
  Sora,
  Space_Grotesk,
} from "next/font/google";

import type { ClaveFuente } from "~/lib/storefront-templates";

/**
 * Las tipografías de las plantillas con tema (Pista, Podio, Noche, Cancha,
 * Tablero), declaradas una vez y pedidas por clave desde el catálogo.
 *
 * Van sin precarga y con swap: la tienda de un fotógrafo usa UNA de estas
 * nueve, y precargar las otras ocho sería pagar las fuentes de plantillas que
 * esa página no dibuja. Lo que viaja en el CSS de la tienda son las reglas
 * @font-face; el navegador baja sólo los archivos de la familia que el texto
 * de verdad usa, que es la de la plantilla elegida.
 *
 * El nombre real de cada familia es el que genera next/font, no el de Google,
 * y por eso la tienda no puede escribir `font-family: "Barlow"`: _cabeza.tsx
 * lee `style.fontFamily` de acá y lo planta en --fuente-plantilla-sans y
 * --fuente-plantilla-display, que es lo que lee styles/tienda-temas.css.
 */
const barlow = Barlow({ subsets: ["latin"], weight: ["400", "500", "600"], display: "swap", preload: false });
const barlowCondensed = Barlow_Condensed({ subsets: ["latin"], weight: ["700", "800"], display: "swap", preload: false });
const archivo = Archivo({ subsets: ["latin"], display: "swap", preload: false });
// La de Velvet: Archivo con el eje de ancho, y SÓLO itálica. next/font
// registra las dos Archivo con el mismo nombre de familia, así que comparten
// familia en el navegador; siendo ésta sólo itálica, el texto recto de Podio
// no puede caer en este archivo (90 KB contra 35) y Velvet, que pide la
// display siempre en itálica, no puede caer en la de Podio, que no tiene ancho.
const archivoAncha = Archivo({ subsets: ["latin"], axes: ["wdth"], style: "italic", display: "swap", preload: false });
const archivoBlack = Archivo_Black({ subsets: ["latin"], weight: "400", display: "swap", preload: false });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], display: "swap", preload: false });
const inter = Inter({ subsets: ["latin"], display: "swap", preload: false });
const sora = Sora({ subsets: ["latin"], display: "swap", preload: false });
const manrope = Manrope({ subsets: ["latin"], display: "swap", preload: false });
const geist = Geist({ subsets: ["latin"], display: "swap", preload: false });

export const FUENTES_PLANTILLA: Record<ClaveFuente, { style: { fontFamily: string } }> = {
  barlow,
  "barlow-condensed": barlowCondensed,
  archivo,
  "archivo-black": archivoBlack,
  "archivo-ancha": archivoAncha,
  "space-grotesk": spaceGrotesk,
  inter,
  sora,
  manrope,
  geist,
};
