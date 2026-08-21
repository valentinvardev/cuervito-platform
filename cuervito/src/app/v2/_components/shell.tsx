"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  Images,
  LayoutGrid,
  LifeBuoy,
  Menu,
  Moon,
  Plus,
  ReceiptText,
  Sparkles,
  Store,
  Sun,
  UserRound,
  Wallet,
  X,
} from "lucide-react";
import { useEffect, useState, useTransition } from "react";

import { whatsappUrl } from "~/lib/support";

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

// Se anuncian antes de existir para que se vea hacia dónde va esto. No llevan a
// ningún lado a propósito: un ítem que se ve igual que los demás y no hace nada
// se prueba una vez, no pasa nada, y se prueba de nuevo.
const PRONTO = [
  { id: "portfolio", icono: Images, texto: "Portfolio" },
  { id: "studio", icono: Sparkles, texto: "Historias" },
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

        <div>
          <div className="rail-sep" />
          <div className="rail-cap">Próximamente</div>
          <div className="rail-nav">
            {PRONTO.map((i) => (
              <span className="rl pronto" key={i.id} aria-disabled="true">
                <i.icono /> {i.texto}
                <span className="rl-pronto">Pronto</span>
              </span>
            ))}
          </div>
        </div>

        <div className="rail-bot">
          {/* Acá y no sólo dentro de Ayuda: cuando algo no funciona nadie busca
              la respuesta en una sección llamada Ayuda, busca a quién
              escribirle. */}
          <a
            href={whatsappUrl()}
            target="_blank"
            rel="noopener"
            className="rail-wa"
            onClick={() => setCajon(false)}
          >
            <svg className="wa" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.65-2.05-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.01-1.04 2.47s1.06 2.87 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35Z" />
              <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.86 9.86 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.5 2 12.04 2Zm0 18.15h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.25-8.23a8.19 8.19 0 0 1 8.24 8.24c0 4.54-3.7 8.23-8.24 8.23Z" />
            </svg>
            Escribinos
          </a>

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

          {/* La marca, sólo cuando el riel se esconde. El CSS la prende en el
              mismo corte que la hamburguesa: en escritorio ya está arriba del
              riel y repetirla sería decir lo mismo dos veces. */}
          <Link href="/v2" className="mark-ico" aria-label="encontrate.app" prefetch />

          <Buscador placeholder={BUSCAR[actual] ?? "Buscar evento, dorsal o venta"} />

          <div className="top-r">
            <button
              className="btn btn-ghost btn-icon"
              onClick={cambiarTema}
              aria-label="Cambiar tema"
              data-tip="Cambiar entre claro y oscuro"
            >
              <span className="ico ico-moon">
                <Moon />
              </span>
              <span className="ico ico-sun">
                <Sun />
              </span>
            </button>
            <Link href="/v2/nuevo" className="btn btn-pri" prefetch>
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
