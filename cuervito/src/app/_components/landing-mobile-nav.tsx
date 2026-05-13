"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function LandingMobileNav({ loggedIn }: { loggedIn: boolean }) {
  const [open, setOpen] = useState(false);

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
      <button
        className="btn btn-ghost nav-mobile"
        aria-label="Menu"
        onClick={() => setOpen(true)}
      >
        <i className="ti ti-menu-2" style={{ fontSize: 22 }}></i>
      </button>

      <div
        className={`drawer-backdrop ${open ? "open" : ""}`}
        onClick={close}
        aria-hidden={!open}
      ></div>
      <aside className={`drawer ${open ? "open" : ""}`} aria-hidden={!open}>
        <div className="drawer-head">
          <Link href="/" className="logo" onClick={close}>
            cuerv<span className="logo-dot"></span>to
          </Link>
          <button className="drawer-close" onClick={close} aria-label="Cerrar">
            <i className="ti ti-x" style={{ fontSize: 18 }}></i>
          </button>
        </div>
        <nav className="drawer-links">
          <a href="#eventos" onClick={close}>
            <span>Eventos</span>
            <i className="ti ti-chevron-right"></i>
          </a>
          <Link href="/signup" onClick={close}>
            <span>Fotógrafos</span>
            <i className="ti ti-chevron-right"></i>
          </Link>
          <a href="#como-funciona" onClick={close}>
            <span>Cómo funciona</span>
            <i className="ti ti-chevron-right"></i>
          </a>
        </nav>
        <div className="drawer-foot">
          {loggedIn ? (
            <Link href="/dashboard" className="btn btn-primary" onClick={close}>
              <i className="ti ti-layout-dashboard"></i>Ir al panel
            </Link>
          ) : (
            <>
              <a href="#eventos" className="btn btn-primary" onClick={close}>
                <i className="ti ti-search"></i>Buscar mis fotos
              </a>
              <Link href="/signup" className="btn btn-outline" onClick={close}>
                Soy fotógrafo
              </Link>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
