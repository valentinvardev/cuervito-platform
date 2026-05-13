"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV = [
  { href: "/dashboard", label: "Panel", icon: "ti-layout-dashboard" },
  { href: "/dashboard/events", label: "Eventos", icon: "ti-calendar-event" },
  { href: "/dashboard/ventas", label: "Ventas", icon: "ti-chart-bar" },
  { href: "/dashboard/tienda", label: "Página de venta", icon: "ti-template" },
  { href: "/dashboard/cobros", label: "Método de pago", icon: "ti-credit-card" },
  { href: "/dashboard/perfil", label: "Perfil", icon: "ti-user" },
  { href: "/dashboard/ayuda", label: "Ayuda", icon: "ti-help-circle" },
];

export function AdminDrawer() {
  const pathname = usePathname() ?? "/dashboard";
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function handleOpen() {
      setOpen(true);
    }
    window.addEventListener("cuervito:open-drawer", handleOpen);
    return () => window.removeEventListener("cuervito:open-drawer", handleOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function close() {
    setOpen(false);
  }

  return (
    <>
      <div
        className={`adm-drawer-backdrop ${open ? "open" : ""}`}
        onClick={close}
        aria-hidden={!open}
      />
      <aside className={`adm-drawer ${open ? "open" : ""}`} aria-hidden={!open}>
        <div className="adm-drawer-head">
          <Link href="/dashboard" className="logo" onClick={close}>
            cuerv<span className="logo-dot"></span>to
          </Link>
          <button className="adm-drawer-close" onClick={close} aria-label="Cerrar menú">
            <i className="ti ti-x" />
          </button>
        </div>

        <nav className="adm-drawer-nav">
          {NAV.map((n) => {
            const active = pathname === n.href;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`adm-drawer-link ${active ? "active" : ""}`}
                onClick={close}
              >
                <i className={`ti ${n.icon}`} />
                <span>{n.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="adm-drawer-foot">
          cuervito.app · v0.1
          <br />
          <Link href="/" style={{ color: "var(--accent)" }}>
            Volver al sitio
          </Link>
        </div>
      </aside>
    </>
  );
}
