import "~/styles/prototype/styles.css";
import "~/styles/prototype/panel-anim.css";
import "~/styles/prototype/admin-nav.css";
import "~/styles/prototype/dashboard.css";

import { redirect } from "next/navigation";

import { auth } from "~/server/auth";

import { AdminTabs } from "./_components/admin-tabs";
import { AdminTop } from "./_components/admin-top";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/admin/users");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@700;800&family=DM+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap"
      />
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.5.0/dist/tabler-icons.min.css"
      />

      <AdminTop name={session.user.name ?? "Admin"} email={session.user.email ?? ""} />

      <AdminTabs />

      {children}
    </>
  );
}
