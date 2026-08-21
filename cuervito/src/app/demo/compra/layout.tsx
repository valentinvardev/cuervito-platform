import "~/styles/tienda-encontrate.css";
import "~/styles/entrega-encontrate.css";

/**
 * El CSS de la compra.
 *
 * Va acá y no en el layout de /demo porque la demo de la subida no usa nada de
 * esto: es la tienda y la entrega, y esa graba el panel.
 *
 * Son los MISMOS archivos que sirven a los usuarios, sin copias: el punto del
 * video es mostrar el producto, no una maqueta que se parezca.
 */
export default function DemoCompraLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
