import "~/styles/v2/tokens.css";
import "~/styles/v2/base.css";
import "~/styles/v2/panel.css";
import "~/styles/v2/dashboard.css";

import { redirect } from "next/navigation";

import { auth } from "~/server/auth";

/**
 * Vista previa del panel rediseñado. Sólo para admins.
 *
 * El guardián va en el layout y no en la página: así cualquier ruta que se
 * agregue debajo de /v2 queda protegida sin que haya que acordarse de repetir
 * el control. Es el mismo patrón que usa /admin.
 *
 * El CSS también se importa acá y no en la página. En el App Router el CSS de
 * un layout se carga sólo en las rutas que cuelgan de él, así que estos tokens
 * no tocan al panel viejo: las dos versiones conviven sin pisarse.
 */
export default async function V2Layout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/v2");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Outfit:wght@200;300;400;500;600&family=Unbounded:wght@700;800;900&display=swap"
      />
      {children}
    </>
  );
}
