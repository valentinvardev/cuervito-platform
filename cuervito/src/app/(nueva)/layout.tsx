import "~/styles/v2/tokens.css";
import "~/styles/v2/base.css";
import "~/styles/landing-encontrate.css";

/**
 * La landing de encontrate.
 *
 * Trae los mismos tokens.css y base.css que ya usan el panel, la tienda y la
 * entrega: son el sistema de diseño de encontrate y no una copia para acá. Lo
 * único propio es landing-encontrate.css.
 *
 * No trae el CSS del prototipo de cuervito, que sí carga la home actual. Son
 * cien kilobytes de otra marca.
 *
 * El tema no se resuelve acá: el layout raíz ya lo escribe en el <html> antes
 * de pintar, y las tipografías también cuelgan de ahí. Repetirlo sería llegar
 * tarde y pisar lo que ya está bien.
 */
export default function LandingLayout({ children }: { children: React.ReactNode }) {
  // Las variables se pisan en un envoltorio y no en :root: las propiedades
  // personalizadas se heredan, así que todo lo de adentro las toma y lo de
  // afuera de esta ruta queda intacto.
  return (
    <div
      style={
        {
          "--meta": "var(--sans)",
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}
