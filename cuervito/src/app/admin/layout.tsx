import "~/styles/prototype/styles.css";
import "~/styles/prototype/panel-anim.css";
import "~/styles/prototype/admin-nav.css";
import "~/styles/prototype/dashboard.css";

// Los tokens de encontrate primero —traen tema claro y oscuro— y encima la
// capa que mapea las variables del prototipo sobre ellos. El orden importa:
// admin.css sólo funciona si llega DESPUÉS de las hojas que va a pisar.
import "~/styles/v2/tokens.css";
import "~/styles/v2/admin.css";

import { redirect } from "next/navigation";

import { auth } from "~/server/auth";

import { TooltipProvider } from "~/app/_components/tooltip-provider";

import { AdminTabs } from "./_components/admin-tabs";
import { AdminTop } from "./_components/admin-top";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/admin/users");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  return (
    <div className="adm">
      {/* Bricolage y DM Sans se fueron con el rebrand: Outfit y Unbounded ya
          las carga el layout raíz con next/font, así que el admin no tiene
          por qué pedirle dos fuentes más a Google en cada carga. */}
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.5.0/dist/tabler-icons.min.css"
      />

      <AdminTop name={session.user.name ?? "Admin"} email={session.user.email ?? ""} />

      <AdminTabs />

      {children}
      <TooltipProvider />
    </div>
  );
}
