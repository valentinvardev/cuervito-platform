import "~/styles/v2/tokens.css";
import "~/styles/v2/base.css";
import "~/styles/v2/panel.css";
import "~/styles/v2/dashboard.css";
import "~/styles/v2/paginas.css";

import { Outfit, Unbounded } from "next/font/google";
import { redirect } from "next/navigation";

import { auth } from "~/server/auth";

/**
 * Las fuentes van por next/font y no por un <link> a Google Fonts.
 *
 * El <link rel="stylesheet"> dentro del JSX de un layout no lo iza React 19 al
 * head salvo que lleve `precedence`, así que la hoja quedaba en el cuerpo y
 * Unbounded no llegaba a aplicarse: los títulos salían con la tipografía de
 * sistema y no con la del laboratorio.
 *
 * Además next/font las auto-hospeda, con lo que se va una petición
 * bloqueante a un tercero y desaparece el salto de tipografía al cargar.
 */
const display = Unbounded({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
  variable: "--fuente-display",
  display: "swap",
});

const sans = Outfit({
  subsets: ["latin"],
  weight: ["200", "300", "400", "500", "600"],
  variable: "--fuente-sans",
  display: "swap",
});

/**
 * Vista previa del panel rediseñado. Sólo para admins.
 *
 * El guardián va en el layout y también en cada página: en el App Router los
 * dos se resuelven en paralelo, así que el del layout no impide que la página
 * corra con sesión nula.
 *
 * El CSS se importa acá y no en las páginas. En el App Router el CSS de un
 * layout se carga sólo en las rutas que cuelgan de él, así que estos tokens no
 * tocan al panel viejo: las dos versiones conviven sin pisarse.
 */
export default async function V2Layout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/v2");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  // Las variables se pisan en un envoltorio y no en :root: las propiedades
  // personalizadas se heredan, así que todo lo de adentro las toma, y lo de
  // afuera de /v2 queda intacto.
  return (
    <div
      className={`${display.variable} ${sans.variable}`}
      style={
        {
          "--display": "var(--fuente-display), system-ui, sans-serif",
          "--sans": "var(--fuente-sans), system-ui, sans-serif",
          "--meta": "var(--fuente-sans), system-ui, sans-serif",
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}
