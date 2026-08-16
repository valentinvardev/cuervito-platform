"use client";

import Link from "next/link";
import {
  CalendarDays,
  LayoutGrid,
  LifeBuoy,
  Menu,
  Moon,
  Plus,
  ReceiptText,
  Search,
  Store,
  Sun,
  UserRound,
  Wallet,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Riel y barra superior de la vista previa.
 *
 * En el laboratorio esto lo inyecta panel.js sobre el DOM; acá es un componente
 * de cliente, que es lo mismo con otra herramienta: una sola definición del
 * menú para todas las pantallas que cuelguen de /v2.
 *
 * Los destinos del riel apuntan al panel ACTUAL, no a rutas /v2 que todavía no
 * existen. Es a propósito: así se puede comparar lado a lado sin quedar en
 * pantallas rotas, y queda claro qué está rediseñado y qué no.
 */
const NAV = [
  { href: "/v2", icono: LayoutGrid, texto: "Inicio", aqui: true },
  { href: "/dashboard/events", icono: CalendarDays, texto: "Eventos" },
  { href: "/dashboard/ventas", icono: ReceiptText, texto: "Ventas" },
  { href: "/dashboard/tienda", icono: Store, texto: "Mi página" },
];

const CUENTA = [
  { href: "/dashboard/cobros", icono: Wallet, texto: "Métodos de pago" },
  { href: "/dashboard/perfil", icono: UserRound, texto: "Perfil" },
  { href: "/dashboard/ayuda", icono: LifeBuoy, texto: "Ayuda" },
];

export function Shell({
  nombre,
  slug,
  iniciales,
  children,
}: {
  nombre: string;
  slug: string;
  iniciales: string;
  children: React.ReactNode;
}) {
  const [cajon, setCajon] = useState(false);

  // El tema se resuelve con la misma clave que usa el panel actual, así que
  // pasar de una versión a la otra no cambia de tema en el camino.
  useEffect(() => {
    const raiz = document.documentElement;
    if (raiz.dataset.theme === undefined || raiz.dataset.theme === "") {
      const guardado = localStorage.getItem("cuervito-theme");
      const hora = new Date().getHours();
      raiz.dataset.theme =
        guardado === "light" ? "" : guardado === "dark" ? "dark" : hora >= 7 && hora < 19 ? "" : "dark";
    }
    raiz.dataset.listo = "1";
  }, []);

  useEffect(() => {
    document.documentElement.dataset.rail = cajon ? "open" : "";
  }, [cajon]);

  function cambiarTema() {
    const raiz = document.documentElement;
    const oscuro = raiz.dataset.theme === "dark";
    raiz.dataset.theme = oscuro ? "" : "dark";
    try {
      localStorage.setItem("cuervito-theme", oscuro ? "light" : "dark");
    } catch {
      // almacenamiento bloqueado: el tema dura lo que dure la pestaña
    }
  }

  return (
    <div className="app">
      <aside className="rail">
        <div className="rail-top">
          <Link href="/v2" className="mark">
            encontrate.app
          </Link>
        </div>

        <nav className="rail-nav">
          {NAV.map((i) => (
            <Link
              key={i.href}
              href={i.href}
              className="rl"
              aria-current={i.aqui ? "page" : undefined}
              onClick={() => setCajon(false)}
            >
              <i.icono /> {i.texto}
            </Link>
          ))}
        </nav>

        <div>
          <div className="rail-sep" />
          <div className="rail-cap">Cuenta</div>
          <nav className="rail-nav">
            {CUENTA.map((i) => (
              <Link key={i.href} href={i.href} className="rl" onClick={() => setCajon(false)}>
                <i.icono /> {i.texto}
              </Link>
            ))}
          </nav>
        </div>

        <div className="rail-bot">
          <Link href="/dashboard/perfil" className="me">
            <span className="me-av">{iniciales}</span>
            <span className="me-txt">
              <b>{nombre}</b>
              <span>encontrate.app/{slug}</span>
            </span>
          </Link>
        </div>
      </aside>

      <div className="col">
        <header className="top">
          <button
            className="btn btn-ghost btn-icon burger-d"
            onClick={() => setCajon((v) => !v)}
            aria-label={cajon ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={cajon}
          >
            <span className="ico ico-menu">{cajon ? <X /> : <Menu />}</span>
          </button>

          <div className="search">
            <Search className="lupa" />
            <input type="search" placeholder="Buscar evento, dorsal o venta" disabled />
          </div>

          <div className="top-r">
            <button className="btn btn-ghost btn-icon" onClick={cambiarTema} aria-label="Cambiar tema">
              <span className="ico ico-moon">
                <Moon />
              </span>
              <span className="ico ico-sun">
                <Sun />
              </span>
            </button>
            <Link href="/dashboard/events/new" className="btn btn-pri">
              <Plus /> Nuevo evento
            </Link>
          </div>
        </header>

        {children}
      </div>

      <div className="rail-scrim" onClick={() => setCajon(false)} />
    </div>
  );
}
