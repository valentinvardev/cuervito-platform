"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type NavItem = {
  href: string;
  label: string;
  desc: string;
  icon: string;
};

const NAV: NavItem[] = [
  {
    href: "/dashboard",
    label: "Panel",
    desc: "Resumen de tu actividad.",
    icon: "ti-layout-dashboard",
  },
  {
    href: "/dashboard/events",
    label: "Eventos",
    desc: "Subí fotos, publicá, gestioná.",
    icon: "ti-calendar-event",
  },
  {
    href: "/dashboard/ventas",
    label: "Ventas",
    desc: "Detalle de cada compra.",
    icon: "ti-chart-bar",
  },
  {
    href: "/dashboard/tienda",
    label: "Página de venta",
    desc: "Tu storefront público.",
    icon: "ti-template",
  },
  {
    href: "/dashboard/cobros",
    label: "Método de pago",
    desc: "Conexión con Mercado Pago.",
    icon: "ti-credit-card",
  },
  {
    href: "/dashboard/perfil",
    label: "Perfil",
    desc: "Datos personales y bio.",
    icon: "ti-user",
  },
  {
    href: "/dashboard/ayuda",
    label: "Ayuda",
    desc: "Guías, FAQ y soporte directo.",
    icon: "ti-help-circle",
  },
];

export function AdminDrawer() {
  const pathname = usePathname() ?? "/dashboard";
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [prefetched, setPrefetched] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    function handleOpen() {
      setOpen(true);
    }
    window.addEventListener("cuervito:open-drawer", handleOpen);
    return () => window.removeEventListener("cuervito:open-drawer", handleOpen);
  }, []);

  // Prefetch every dashboard section the first time the drawer opens.
  useEffect(() => {
    if (!open || prefetched) return;
    for (const n of NAV) {
      router.prefetch(n.href);
    }
    setPrefetched(true);
  }, [open, prefetched, router]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function close() {
    setOpen(false);
  }

  if (!mounted) return null;

  const content = (
    <div
      aria-hidden={!open}
      style={{
        position: "fixed",
        inset: 0,
        // SOLID background — no transparency. Sits on top of everything in
        // the dashboard so the z-index of underlying elements never bleeds
        // through.
        background: "var(--bg-base)",
        zIndex: 9999,
        opacity: open ? 1 : 0,
        pointerEvents: open ? "auto" : "none",
        transition:
          "opacity 220ms cubic-bezier(.2,.9,.3,1), transform 280ms cubic-bezier(.2,.9,.3,1)",
        transform: open ? "translateY(0)" : "translateY(-8px)",
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
      }}
    >
      {/* Header */}
      <header
        style={{
          height: 64,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 22px",
          borderBottom: "1px solid var(--border-subtle)",
          background: "rgba(15, 13, 11, 0.92)",
          position: "sticky",
          top: 0,
          zIndex: 1,
          backdropFilter: "blur(8px)",
        }}
      >
        <Link
          href="/dashboard"
          onClick={close}
          className="logo"
          style={{ textDecoration: "none" }}
        >
          cuerv<span className="logo-dot"></span>to
        </Link>
        <button
          type="button"
          onClick={close}
          aria-label="Cerrar menú"
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: "transparent",
            border: "1px solid transparent",
            color: "var(--text-secondary)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            transition: "background 150ms ease, color 150ms ease, border-color 150ms ease",
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget as HTMLButtonElement;
            el.style.background = "var(--bg-surface)";
            el.style.borderColor = "var(--border-subtle)";
            el.style.color = "var(--text-primary)";
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLButtonElement;
            el.style.background = "transparent";
            el.style.borderColor = "transparent";
            el.style.color = "var(--text-secondary)";
          }}
        >
          <i className="ti ti-x" style={{ fontSize: 22 }} />
        </button>
      </header>

      {/* Nav grid */}
      <main
        style={{
          flex: 1,
          padding: "32px 22px 22px",
          maxWidth: 880,
          width: "100%",
          margin: "0 auto",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--text-tertiary)",
            marginBottom: 14,
            paddingLeft: 4,
          }}
        >
          Menú
        </div>
        <nav
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 10,
          }}
        >
          {NAV.map((n) => {
            const active = pathname === n.href;
            return (
              <Link
                key={n.href}
                href={n.href}
                onClick={close}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "16px 18px",
                  borderRadius: 12,
                  background: active ? "var(--accent-deep)" : "var(--bg-surface)",
                  border: active
                    ? "1px solid var(--border-accent)"
                    : "1px solid var(--border-subtle)",
                  color: active ? "var(--accent)" : "var(--text-primary)",
                  textDecoration: "none",
                  transition: "background 140ms ease, border-color 140ms ease, transform 160ms ease",
                }}
                onMouseEnter={(e) => {
                  if (active) return;
                  const el = e.currentTarget as HTMLAnchorElement;
                  el.style.borderColor = "var(--border-accent)";
                  el.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  if (active) return;
                  const el = e.currentTarget as HTMLAnchorElement;
                  el.style.borderColor = "var(--border-subtle)";
                  el.style.transform = "translateY(0)";
                }}
              >
                <span
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 11,
                    background: "var(--accent-deep)",
                    border: "1px solid var(--border-accent)",
                    color: "var(--accent)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 20,
                    flexShrink: 0,
                  }}
                >
                  <i className={`ti ${n.icon}`} />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      display: "block",
                      fontFamily: "var(--font-display)",
                      fontWeight: 700,
                      fontSize: 15,
                      letterSpacing: "-0.015em",
                      marginBottom: 2,
                    }}
                  >
                    {n.label}
                  </span>
                  <span
                    style={{
                      display: "block",
                      fontSize: 12.5,
                      color: active ? "var(--accent)" : "var(--text-tertiary)",
                      opacity: active ? 0.85 : 1,
                    }}
                  >
                    {n.desc}
                  </span>
                </span>
                <i
                  className="ti ti-arrow-right"
                  style={{
                    fontSize: 16,
                    color: active ? "var(--accent)" : "var(--text-tertiary)",
                    flexShrink: 0,
                  }}
                />
              </Link>
            );
          })}
        </nav>
      </main>

      {/* Footer */}
      <footer
        style={{
          padding: "18px 22px 22px",
          borderTop: "1px solid var(--border-subtle)",
          fontSize: 12,
          color: "var(--text-tertiary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 14,
          flexWrap: "wrap",
        }}
      >
        <span>cuervito.app · v0.1</span>
        <Link
          href="/"
          onClick={close}
          style={{
            color: "var(--accent)",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <i className="ti ti-external-link" />
          Volver al sitio
        </Link>
      </footer>
    </div>
  );

  // Portal to <html> so no ancestor transform/filter scopes us.
  return createPortal(content, document.documentElement);
}
