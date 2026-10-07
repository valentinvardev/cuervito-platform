import "~/styles/blog-encontrate.css";
import "~/styles/blog-ilustraciones.css";

import { Pie } from "../_pie";
import { Encabezado } from "../_piezas";

/**
 * El blog cuelga de (nueva): tiene la barra, el pie y la tipografía de la
 * landing. Lo propio está en blog-encontrate.css, aparte de landing-encontrate
 * porque esa es copia del laboratorio y no se edita acá.
 *
 * El encabezado va sin `logueado`: así lo resuelve el navegador y la página no
 * lee la cookie, que es lo que la dejaría de hacer estática.
 */
export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Encabezado />
      {children}
      <Pie />
    </>
  );
}
