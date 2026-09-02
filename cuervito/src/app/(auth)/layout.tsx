import "~/styles/v2/tokens.css";
import "~/styles/v2/base.css";
import "~/styles/auth-encontrate.css";
import "~/styles/auth-estados.css";

/**
 * Las cuatro pantallas de autenticación.
 *
 * Trae los mismos tokens.css y base.css que el panel, la tienda, la entrega y
 * la landing: son el sistema de encontrate y no una copia para acá. Ya no carga
 * nada del prototipo de cuervito ni las fuentes ni los íconos de Tabler por
 * CDN, que era lo que hacía que estas pantallas tardaran en pintar por dos
 * pedidos a servidores ajenos antes del primer píxel.
 *
 * El armazón de dos columnas —formulario a la izquierda, foto a la derecha— es
 * de las cuatro, así que vive acá y no se repite en cada página.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  // Las variables se pisan en un envoltorio y no en :root: las propiedades
  // personalizadas se heredan, así que todo lo de adentro las toma y lo de
  // afuera de estas rutas queda intacto.
  return (
    <div
      style={
        {
          "--meta": "var(--sans)",
        } as React.CSSProperties
      }
    >
      <main className="auth">{children}</main>
    </div>
  );
}
