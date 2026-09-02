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
 * PRECARGA. Estuvo apagada por una razón que ya no corre: cuando esto era el
 * rediseño de /v2, la página pública del fotógrafo no usaba ninguna de las dos
 * y precargar doce woff2 ahí era pagar el rebrand en el lugar donde más
 * cuesta. Hoy las usan la landing, el panel, el panel de administración y la
 * tienda —que es la plantilla de encontrate—, o sea prácticamente todo.
 *
 * Sin precarga, con display:swap, cada pantalla arranca dibujada en la
 * tipografía del sistema y salta cuando llega la real. Ese salto es
 * exactamente lo que se ve al entrar al panel.
 *
 * Sólo la SANS se precarga. La display se usa en los títulos, que son cuatro
 * palabras: si llega tarde salta un renglón y se nota mucho menos que si
 * saltara el cuerpo entero. Y son tres pesos de una fuente pesada —el archivo
 * de Unbounded es ocho veces el de Outfit— que no vale bloquear.
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
  preload: true,
});
