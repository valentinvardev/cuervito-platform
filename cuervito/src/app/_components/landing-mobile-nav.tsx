"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type NavItem = {
  href: string;
  label: string;
  desc: string;
  icon: string;
  internal?: boolean;
};

const NAV: NavItem[] = [
  {
    href: "#eventos",
    label: "Eventos",
    desc: "Buscá fotos de las carreras y eventos cubiertos por Cuervito.",
    icon: "ti-calendar-event",
  },
  {
    href: "/signup",
    label: "Fotógrafos",
    desc: "Vendé tus fotos con reconocimiento facial y de dorsales.",
    icon: "ti-camera",
    internal: true,
  },
  {
    href: "#como-funciona",
    label: "Cómo funciona",
    desc: "El paso a paso de comprar y descargar tus fotos.",
    icon: "ti-info-circle",
  },
];

export function LandingMobileNav({ loggedIn }: { loggedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

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

  const drawer = (
    <div
      aria-hidden={!open}
      style={{
        position: "fixed",
        inset: 0,
        // Solid background — no transparency, no z-index bleed.
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
          href="/"
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
          maxWidth: 720,
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
            gridTemplateColumns: "1fr",
            gap: 10,
            marginBottom: 28,
          }}
        >
          {NAV.map((n) => {
            const LinkEl = (n.internal ? Link : "a") as React.ElementType;
            return (
              <LinkEl
                key={n.href}
                href={n.href}
                onClick={close}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "16px 18px",
                  borderRadius: 12,
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-primary)",
                  textDecoration: "none",
                  transition: "background 140ms ease, border-color 140ms ease, transform 160ms ease",
                }}
                onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => {
                  const el = e.currentTarget;
                  el.style.borderColor = "var(--border-accent)";
                  el.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => {
                  const el = e.currentTarget;
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
                      fontSize: 16,
                      letterSpacing: "-0.015em",
                      marginBottom: 2,
                    }}
                  >
                    {n.label}
                  </span>
                  <span
                    style={{
                      display: "block",
                      fontSize: 13,
                      color: "var(--text-tertiary)",
                      lineHeight: 1.4,
                    }}
                  >
                    {n.desc}
                  </span>
                </span>
                <i
                  className="ti ti-arrow-right"
                  style={{
                    fontSize: 16,
                    color: "var(--text-tertiary)",
                    flexShrink: 0,
                  }}
                />
              </LinkEl>
            );
          })}
        </nav>

        {/* CTA */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {loggedIn ? (
            <Link href="/dashboard" className="btn btn-primary" onClick={close}>
              <i className="ti ti-layout-dashboard"></i>
              Ir al panel
            </Link>
          ) : (
            <>
              <a href="#eventos" className="btn btn-primary" onClick={close}>
                <i className="ti ti-search"></i>
                Buscar mis fotos
              </a>
              <Link href="/signup" className="btn btn-outline" onClick={close}>
                <i className="ti ti-camera"></i>
                Soy fotógrafo
              </Link>
              <Link
                href="/login"
                onClick={close}
                style={{
                  textAlign: "center",
                  fontSize: 13,
                  color: "var(--text-tertiary)",
                  textDecoration: "none",
                  marginTop: 6,
                }}
              >
                ¿Ya tenés cuenta? <span style={{ color: "var(--accent)" }}>Iniciar sesión</span>
              </Link>
            </>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer
        style={{
          padding: "18px 22px 22px",
          borderTop: "1px solid var(--border-subtle)",
          fontSize: 12,
          color: "var(--text-tertiary)",
          textAlign: "center",
        }}
      >
        cuervito.app
      </footer>
    </div>
  );

  return (
    <>
      <button
        className="btn btn-ghost nav-mobile"
        aria-label="Menu"
        onClick={() => setOpen(true)}
      >
        <i className="ti ti-menu-2" style={{ fontSize: 22 }}></i>
      </button>

      {mounted && createPortal(drawer, document.documentElement)}
    </>
  );
}
