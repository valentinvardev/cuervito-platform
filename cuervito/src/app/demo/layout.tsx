import "~/styles/tienda-encontrate.css";
import "~/styles/entrega-encontrate.css";
import "~/styles/demo.css";

/**
 * Layout de la demo.
 *
 * Trae el CSS de la tienda y el de la entrega —los mismos archivos que sirven a
 * los usuarios, sin copias— más una hoja chiquita con lo único que existe para
 * grabar: el halo de qué se está tocando, el rótulo del paso y la barra de
 * avance.
 *
 * No trae el prototipo viejo, que sí carga el layout de /descarga: acá no hace
 * falta y son 100 KB de CSS que no se usan.
 */
export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
