import { Outfit, Unbounded } from "next/font/google";

/**
 * Las tipografías de encontrate, declaradas ACÁ y aplicadas en el layout raíz.
 *
 * Estaban declaradas en el layout de /v2, que es lo natural porque son las
 * únicas pantallas que las usan. El problema es cómo terminan empaquetadas:
 * Next partió el CSS de /v2 en dos pedazos y las @font-face quedaron en uno
 * solo. Los dos hacen falta en cada pantalla, pero el que traía las fuentes no
 * siempre era el primero en aplicarse, así que los títulos salían con la
 * tipografía del sistema hasta que uno recargaba. Medido sobre el build: un
 * chunk con `.rail` y cero @font-face, otro con las 16 @font-face.
 *
 * Declaradas desde el layout raíz, las @font-face viajan en el chunk que está
 * siempre presente y es bloqueante, junto a las de Geist. Deja de haber un
 * orden de llegada del que depender.
 *
 * preload en false a propósito: el layout raíz lo comparte TODA la app, y
 * precargar doce woff2 en la página pública del fotógrafo —que no usa ninguna
 * de las dos— sería pagar el rebrand en el lugar donde más cuesta. Sin
 * precarga, el archivo se pide cuando una pantalla de /v2 lo necesita y
 * display:swap se ocupa del resto.
 */
export const display = Unbounded({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
  variable: "--fuente-display",
  display: "swap",
  preload: false,
});

export const sans = Outfit({
  subsets: ["latin"],
  weight: ["200", "300", "400", "500", "600"],
  variable: "--fuente-sans",
  display: "swap",
  preload: false,
});
