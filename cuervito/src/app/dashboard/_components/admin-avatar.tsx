"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export function AdminAvatar({
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
  avatarUrl?: string | null;
  signOutAction: () => void | Promise<void>;
  showAdminLink?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="adm-profile-wrap" ref={ref}>
      <div
        className="adm-avatar"
        title="Cuenta"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        style={
          avatarUrl
            ? {
                backgroundImage: `url(${avatarUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                color: "transparent",
              }
            : undefined
        }
      >
        {!avatarUrl && initials}
      </div>
      <div className={`adm-dropdown ${open ? "open" : ""}`} role="menu">
        <div className="adm-dropdown-user">
          <span className="name">{userName}</span>
          {userEmail && <span className="mail">{userEmail}</span>}
        </div>
        <Link href="/dashboard/perfil" className="adm-dropdown-item" role="menuitem">
          <i className="ti ti-user-edit" />
          <span>Editar perfil</span>
        </Link>
        {showAdminLink && (
          <Link href="/admin/users" className="adm-dropdown-item" role="menuitem">
            <i className="ti ti-shield-check" />
            <span>Panel admin</span>
          </Link>
        )}
        <div className="adm-dropdown-sep" />
        <form action={signOutAction}>
          <button type="submit" className="adm-dropdown-item danger" role="menuitem">
            <i className="ti ti-logout" />
            <span>Cerrar sesión</span>
          </button>
        </form>
      </div>
    </div>
  );
}
