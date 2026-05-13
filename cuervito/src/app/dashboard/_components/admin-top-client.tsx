"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { AdminAvatar } from "./admin-avatar";

export function AdminTopClient({
  initials,
  userName,
  userEmail,
  avatarUrl,
  signOutAction,
  showAdminLink = false,
}: {
  initials: string;
  userName: string;
  userEmail: string;
  avatarUrl: string | null;
  signOutAction: () => void | Promise<void>;
  showAdminLink?: boolean;
}) {
  const pathname = usePathname() ?? "/dashboard";
  const isRoot = pathname === "/dashboard";

  return (
    <header className="adm-top">
      <div className="adm-top-left">
        {isRoot ? (
          <button
            className="adm-nav-btn"
            aria-label="Abrir menú"
            onClick={() => window.dispatchEvent(new CustomEvent("cuervito:open-drawer"))}
          >
            <span className="adm-nav-icons">
              <i
                className="ti ti-menu-2 adm-icon-menu"
                style={{ opacity: 1, transform: "none" }}
              />
            </span>
          </button>
        ) : (
          <Link href="/dashboard" className="adm-nav-btn" aria-label="Volver al panel">
            <span className="adm-nav-icons">
              <i
                className="ti ti-arrow-left adm-icon-back"
                style={{ opacity: 1, transform: "none" }}
              />
            </span>
            <span className="adm-nav-label">Volver</span>
          </Link>
        )}
      </div>

      <div className="adm-top-center">
        <Link href="/dashboard" className="logo">
          cuerv<span className="logo-dot"></span>to
        </Link>
      </div>

      <div className="adm-top-right">
        <AdminAvatar
          initials={initials}
          userName={userName}
          userEmail={userEmail}
          avatarUrl={avatarUrl}
          signOutAction={signOutAction}
          showAdminLink={showAdminLink}
        />
      </div>
    </header>
  );
}
