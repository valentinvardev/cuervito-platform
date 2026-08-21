import "~/styles/demo.css";

/**
 * Layout de las demos grabables.
 *
 * Sólo trae la hoja chiquita con lo único que existe para grabar: el halo de
 * qué se está tocando, el rótulo del paso y la barra de avance.
 *
 * El CSS de cada pantalla lo trae la demo que lo necesita —/demo/compra el de
 * la tienda, /demo/subida el del panel— porque son megas de estilos y ninguna
 * de las dos usa los de la otra.
 */
export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
