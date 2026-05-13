import Link from "next/link";

import { signOut } from "~/server/auth";

import { AdminAvatar } from "../../dashboard/_components/admin-avatar";

export function AdminTop({ name, email }: { name: string; email: string }) {
  const initials =
    name
      .split(" ")
      .map((p) => p[0]?.toUpperCase() ?? "")
      .filter(Boolean)
      .slice(0, 2)
      .join("") || "A";

  async function doSignOut() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <header className="adm-top">
      <div className="adm-top-left">
        <Link href="/dashboard" className="adm-nav-btn" aria-label="Volver al panel">
          <span className="adm-nav-icons">
            <i className="ti ti-arrow-left adm-icon-back" style={{ opacity: 1, transform: "none" }} />
          </span>
          <span className="adm-nav-label">Salir</span>
        </Link>
      </div>

      <div className="adm-top-center" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <Link href="/dashboard" className="logo">
          cuerv<span className="logo-dot"></span>to
        </Link>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--accent)",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            marginTop: -2,
          }}
        >
          admin
        </span>
      </div>

      <div className="adm-top-right">
        <AdminAvatar
          initials={initials}
          userName={name}
          userEmail={email}
          signOutAction={doSignOut}
          showAdminLink={false}
        />
      </div>
    </header>
  );
}
