import {
  Anton,
  Fraunces,
  Geist,
  Geist_Mono,
  IBM_Plex_Mono,
  Instrument_Sans,
  Instrument_Serif,
  Inter_Tight,
  JetBrains_Mono,
  Manrope,
  Playfair_Display,
  Space_Grotesk,
  Space_Mono,
} from "next/font/google";

/**
 * Las tipografías de las plantillas de portfolio.
 *
 * En photo-saas venían de @fontsource: 30 paquetes y un import de CSS por
 * peso, todos cargados en cada página aunque la plantilla usara tres. Acá van
 * con next/font, que las sirve desde el mismo dominio y sólo declara las
 * @font-face: el navegador baja únicamente las que la página usa de verdad.
 *
 * Sin precarga: un portfolio usa una plantilla, y precargar las trece
 * familias sería bajar diez que no se van a usar.
 *
 * El diseño guardado nombra las fuentes por su variable (`var(--pf-...)`),
 * no por el nombre de la familia: next/font les pone un nombre con hash que
 * cambia entre builds, y un diseño guardado con ese nombre se rompería en el
 * deploy siguiente.
 *
 * Las opciones van escritas en cada llamada y no compartidas en un objeto:
 * next/font las lee al compilar y sólo acepta literales.
 */
const instrumentSerif = Instrument_Serif({ subsets: ["latin"], display: "swap", preload: false, weight: "400", style: ["normal", "italic"], variable: "--pf-instrument-serif" });
const geist = Geist({ subsets: ["latin"], display: "swap", preload: false, weight: ["300", "400", "500", "600"], variable: "--pf-geist" });
const geistMono = Geist_Mono({ subsets: ["latin"], display: "swap", preload: false, weight: ["400", "500"], variable: "--pf-geist-mono" });
const playfair = Playfair_Display({ subsets: ["latin"], display: "swap", preload: false, weight: ["400", "500", "600", "700"], style: ["normal", "italic"], variable: "--pf-playfair" });
const manrope = Manrope({ subsets: ["latin"], display: "swap", preload: false, weight: ["400", "500", "600", "700"], variable: "--pf-manrope" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], display: "swap", preload: false, weight: ["400", "500", "600"], variable: "--pf-plex-mono" });
const fraunces = Fraunces({ subsets: ["latin"], display: "swap", preload: false, weight: ["300", "400", "500", "600"], style: ["normal", "italic"], variable: "--pf-fraunces" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], display: "swap", preload: false, weight: ["400", "500", "600", "700"], variable: "--pf-space-grotesk" });
const spaceMono = Space_Mono({ subsets: ["latin"], display: "swap", preload: false, weight: ["400", "700"], style: ["normal", "italic"], variable: "--pf-space-mono" });

const anton = Anton({ subsets: ["latin"], display: "swap", preload: false, weight: "400", variable: "--pf-anton" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], display: "swap", preload: false, weight: ["400", "500", "700"], variable: "--pf-jetbrains-mono" });
const instrumentSans = Instrument_Sans({ subsets: ["latin"], display: "swap", preload: false, weight: ["400", "500", "600"], variable: "--pf-instrument-sans" });
const interTight = Inter_Tight({ subsets: ["latin"], display: "swap", preload: false, weight: ["400", "500", "600"], variable: "--pf-inter-tight" });

/** Las clases que definen las variables. Van en el contenedor del sitio. */
export const clasesFuentes = [
  instrumentSerif, geist, geistMono, playfair, manrope, plexMono, fraunces, spaceGrotesk, spaceMono,
  anton, jetbrainsMono, instrumentSans, interTight,
]
  .map((f) => f.variable)
  .join(" ");
