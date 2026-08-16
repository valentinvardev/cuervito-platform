"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  LayoutGrid,
  LifeBuoy,
  Menu,
  Moon,
  Plus,
  ReceiptText,
  Store,
  Sun,
  UserRound,
  Wallet,
  X,
} from "lucide-react";
import { useEffect, useState, useTransition } from "react";

import { Buscador } from "./buscador";

/**
 * Riel y barra superior.
 *
 * Vive en el LAYOUT y no en cada página. Cuando estaba en la página, cada
 * navegación desmontaba el armazón entero y lo volvía a construir: se veía
 * parpadear el riel y la barra en cada click, que es de donde salía la
 * sensación de lentitud. Desde el layout, React lo mantiene montado y sólo
 * cambia el contenido.
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

const BUSCAR: Record<string, string> = {
  eventos: "Buscar evento por nombre o lugar",
  ventas: "Buscar por comprador, mail o dorsal",
};

function idDeRuta(p: string) {
  if (p === "/v2") return "inicio";
  return p.replace("/v2/", "").split("/")[0] ?? "inicio";
}

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
  const ruta = usePathname();
  const [cajon, setCajon] = useState(false);
  const [, empezar] = useTransition();

  // Destino optimista: el riel se marca al soltar el click, sin esperar a que
  // el servidor conteste. usePathname sólo cambia cuando la navegación ya
  // terminó, y hasta entonces el ítem apretado seguía apagado: se sentía como
  // que el click no había hecho nada.
  const [pedido, setPedido] = useState<string | null>(null);
  const actual = idDeRuta(ruta);
  const activo = pedido ?? actual;

  useEffect(() => {
    setPedido(null);
  }, [ruta]);

  // El tema ya lo eligió el script bloqueante del layout raíz, antes del primer
  // pintado y con esta misma política (guardado → hora → oscuro). Repetirla acá
  // era además de más: corría después de la hidratación, así que sólo podía
  // llegar tarde. Lo único que falta es avisar que el armazón ya está montado,
  // que es lo que apaga los esqueletos de panel.css.
  useEffect(() => {
    document.documentElement.dataset.listo = "1";
  }, []);

  useEffect(() => {
    document.documentElement.dataset.rail = cajon ? "open" : "";
  }, [cajon]);

  /**
   * data-theme vale "light" o "dark", nunca otra cosa.
   *
   * Antes esta función escribía "" para el modo claro. Adentro de /v2 se veía
   * bien, porque el CSS pregunta por [data-theme="dark"] y cualquier otro valor
   * es claro. El daño estaba afuera: el interruptor del panel viejo lee
   * `dataset.theme === "light" ? "light" : "dark"`, así que con "" se convencía
   * de estar en oscuro estando en claro, mostraba el ícono equivocado y el
   * primer click no hacía nada visible. Alcanzaba con pasar una vez por /v2
   * para dejarlo así.
   */
  function cambiarTema() {
    const raiz = document.documentElement;
    const proximo = raiz.dataset.theme === "dark" ? "light" : "dark";
    raiz.dataset.theme = proximo;
    try {
      localStorage.setItem("cuervito-theme", proximo);
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
      prefetch
      onClick={() => {
        setPedido(i.id);
        setCajon(false);
        empezar(() => {
          /* marca la navegación como transición para que React no bloquee */
        });
      }}
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

          <Buscador placeholder={BUSCAR[actual] ?? "Buscar evento, dorsal o venta"} />

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
