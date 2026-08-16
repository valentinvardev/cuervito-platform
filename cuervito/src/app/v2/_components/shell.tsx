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
 * Todos los destinos son rutas /v2. Antes apuntaban al panel actual, y el
 * resultado era que cualquier click te sacaba de la versión nueva y ya no se
 * podía recorrer: para comparar dos diseños hay que poder quedarse adentro de
 * uno el tiempo suficiente.
 *
 * Las pantallas que todavía no están rediseñadas existen igual como ruta /v2 y
 * muestran el armazón nuevo con un aviso y el enlace a la actual. Es preferible
 * a un enlace que te expulsa sin avisar.
 */
const NAV = [
  { id: "inicio", href: "/v2", icono: LayoutGrid, texto: "Inicio" },
  { id: "eventos", href: "/v2/eventos", icono: CalendarDays, texto: "Eventos" },
  { id: "ventas", href: "/v2/ventas", icono: ReceiptText, texto: "Ventas" },
  { id: "pagina", href: "/v2/pagina", icono: Store, texto: "Mi página" },
];

const CUENTA = [
  { id: "pagos", href: "/v2/pagos", icono: Wallet, texto: "Métodos de pago" },
  { id: "perfil", href: "/v2/perfil", icono: UserRound, texto: "Perfil" },
  { id: "ayuda", href: "/v2/ayuda", icono: LifeBuoy, texto: "Ayuda" },
];

export function Shell({
  nombre,
  slug,
  iniciales,
  activo,
  buscar = "Buscar evento, dorsal o venta",
  children,
}: {
  nombre: string;
  slug: string;
  iniciales: string;
  activo: string;
  buscar?: string;
  children: React.ReactNode;
}) {
  const [cajon, setCajon] = useState(false);

  // Misma clave de tema que el panel actual, así pasar de una versión a la
  // otra no cambia de tema en el camino.
  useEffect(() => {
    const raiz = document.documentElement;
    if (!raiz.dataset.theme) {
      const guardado = localStorage.getItem("cuervito-theme");
      const hora = new Date().getHours();
      raiz.dataset.theme =
        guardado === "light"
          ? ""
          : guardado === "dark"
            ? "dark"
            : hora >= 7 && hora < 19
              ? ""
              : "dark";
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

  const item = (i: (typeof NAV)[number]) => (
    <Link
      key={i.id}
      href={i.href}
      className="rl"
      aria-current={i.id === activo ? "page" : undefined}
      onClick={() => setCajon(false)}
    >
      <i.icono /> {i.texto}
    </Link>
  );

  return (
    <div className="app">
      <aside className="rail">
        <div className="rail-top">
          <Link href="/v2" className="mark">
            encontrate.app
          </Link>
        </div>

        <nav className="rail-nav">{NAV.map(item)}</nav>

        <div>
          <div className="rail-sep" />
          <div className="rail-cap">Cuenta</div>
          <nav className="rail-nav">{CUENTA.map(item)}</nav>
        </div>

        <div className="rail-bot">
          <Link href="/v2/perfil" className="me">
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
            <input type="search" placeholder={buscar} disabled />
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
