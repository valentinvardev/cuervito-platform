"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  Droplets,
  Images,
  LayoutGrid,
  LifeBuoy,
  LogOut,
  Mail,
  Menu,
  Moon,
  Palette,
  Plus,
  ReceiptText,
  Settings,
  ShieldCheck,
  Sparkles,
  Store,
  Sun,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { Suspense, useCallback, useEffect, useState, useTransition } from "react";

import { whatsappUrl } from "~/lib/support";

import { Buscador } from "./buscador";
import { cerrarSesionAction } from "./cuenta";
import { GlifoWhatsapp } from "./glifo-whatsapp";
import { type DatosPerfil, PerfilModal } from "./perfil-modal";
import { VentasEnVivo } from "./ventas-en-vivo";

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
  { id: "inicio", href: "/dashboard", icono: LayoutGrid, texto: "Inicio" },
  { id: "eventos", href: "/dashboard/eventos", icono: CalendarDays, texto: "Eventos" },
  { id: "ventas", href: "/dashboard/ventas", icono: ReceiptText, texto: "Ventas" },
  { id: "pagina", href: "/dashboard/pagina", icono: Store, texto: "Mi página" },
];

// El perfil no está acá: se abre como diálogo desde la tarjeta de abajo del
// riel, la que tiene tu nombre, que es donde se lo va a buscar.
const CUENTA = [
  { id: "pagos", href: "/dashboard/pagos", icono: Wallet, texto: "Métodos de pago" },
  { id: "ayuda", href: "/dashboard/ayuda", icono: LifeBuoy, texto: "Ayuda" },
];

// Sólo para quien tiene el rol. Va en Cuenta y no en el riel principal: el
// admin es una puerta a otro lugar, no una sección del panel.
const ADMIN_ITEM = { id: "admin", href: "/admin/users", icono: ShieldCheck, texto: "Admin" };

/**
 * El riel del panel de administración.
 *
 * El admin tenía su propio armazón —barra arriba, pestañas debajo— heredado
 * del prototipo de cuervito, con otra fuente, otro tema y otro ritmo. Ahora
 * es EL MISMO componente que el panel del fotógrafo con otra lista de
 * destinos: la marca, el buscador, el tema y el aviso de ventas se comparten
 * y no hay dos maneras de hacer lo mismo.
 */
const NAV_ADMIN = [
  { id: "users", href: "/admin/users", icono: Users, texto: "Usuarios" },
  { id: "eventos", href: "/admin/eventos", icono: CalendarDays, texto: "Eventos" },
  { id: "sales", href: "/admin/sales", icono: ReceiptText, texto: "Ventas" },
  { id: "metricas", href: "/admin/metricas", icono: BarChart3, texto: "Métricas" },
  { id: "correos", href: "/admin/correos", icono: Mail, texto: "Correos" },
];
const NAV_ADMIN_HERRAMIENTAS = [
  { id: "watermark", href: "/admin/watermark", icono: Droplets, texto: "Marca de agua" },
  { id: "editor", href: "/admin/editor", icono: Palette, texto: "Editor" },
  { id: "settings", href: "/admin/settings", icono: Settings, texto: "Configuración" },
];

// Se anuncian antes de existir para que se vea hacia dónde va esto. No llevan a
// ningún lado a propósito: un ítem que se ve igual que los demás y no hace nada
// se prueba una vez, no pasa nada, y se prueba de nuevo.
const PRONTO = [{ id: "portfolio", icono: Images, texto: "Portfolio" }];

// Historias está abierta para todos desde septiembre de 2026. Si la llave de
// emergencia la cierra, para quien no la tiene vuelve a ser un anuncio; para
// quien sí, es un ítem más del riel y no una sección aparte:
// el día que se abra a todos no cambia nada de lugar.
const HISTORIAS = {
  id: "historias",
  href: "/dashboard/historias",
  icono: Sparkles,
  texto: "Historias",
};
const HISTORIAS_PRONTO = { id: "studio", icono: Sparkles, texto: "Historias" };

const BUSCAR: Record<string, string> = {
  eventos: "Buscar evento por nombre o lugar",
  ventas: "Buscar por comprador, mail o dorsal",
};

/**
 * Abre el perfil cuando la URL trae ?perfil=1: así lo abren los avisos de
 * Inicio, y lo que quede apuntando a la vieja página /dashboard/perfil. Va
 * aparte y dentro de un Suspense porque leer la URL en el armazón no puede
 * frenar el resto del riel. El parámetro se saca enseguida: si no, recargar la
 * página lo volvería a abrir.
 */
function PerfilDesdeUrl({ abrir }: { abrir: () => void }) {
  const pedido = useSearchParams().get("perfil") === "1";
  useEffect(() => {
    if (!pedido) return;
    abrir();
    const url = new URL(window.location.href);
    url.searchParams.delete("perfil");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  }, [pedido, abrir]);
  return null;
}

function idDeRuta(p: string) {
  if (p === "/dashboard") return "inicio";
  if (p.startsWith("/admin/")) return p.replace("/admin/", "").split("/")[0] ?? "users";
  return p.replace("/dashboard/", "").split("/")[0] ?? "inicio";
}

export function Shell({
  historias = false,
  esAdmin = false,
  modo = "panel",
  nombre,
  slug,
  iniciales,
  perfil,
  children,
}: {
  /** Si el usuario tiene la beta del estudio de historias. */
  historias?: boolean;
  /** Tiene el rol: aparece la entrada al panel de administración. */
  esAdmin?: boolean;
  /** "admin" dibuja el riel de administración en vez del del fotógrafo. */
  modo?: "panel" | "admin";
  nombre: string;
  slug: string;
  iniciales: string;
  /** Lo que muestra y edita el diálogo de perfil. */
  perfil: DatosPerfil;
  children: React.ReactNode;
}) {
  const ruta = usePathname();
  const [cajon, setCajon] = useState(false);
  const [, empezar] = useTransition();
  const [verPerfil, setVerPerfil] = useState(false);
  // Estables: el diálogo los usa en sus efectos, y uno nuevo en cada render lo
  // haría volver a enfocar el primer campo con cada tecla.
  const abrirPerfil = useCallback(() => {
    setVerPerfil(true);
    setCajon(false);
  }, []);
  const cerrarPerfil = useCallback(() => setVerPerfil(false), []);

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

  const admin = modo === "admin";

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
          <Link href={admin ? "/admin/users" : "/dashboard"} className="mark">
            encontrate.app
          </Link>
        </div>

        {admin ? (
          <>
            <nav className="rail-nav">{NAV_ADMIN.map(item)}</nav>

            <div>
              <div className="rail-sep" />
              <div className="rail-cap">Herramientas</div>
              <nav className="rail-nav">{NAV_ADMIN_HERRAMIENTAS.map(item)}</nav>
            </div>

            <div>
              <div className="rail-sep" />
              <nav className="rail-nav">
                <Link href="/dashboard" className="rl" prefetch onClick={() => setCajon(false)}>
                  <ArrowLeft /> Volver al panel
                </Link>
              </nav>
            </div>
          </>
        ) : (
          <>
            <nav className="rail-nav">{(historias ? [...NAV, HISTORIAS] : NAV).map(item)}</nav>

            <div>
              <div className="rail-sep" />
              <div className="rail-cap">Cuenta</div>
              <nav className="rail-nav">
                {(esAdmin ? [...CUENTA, ADMIN_ITEM] : CUENTA).map(item)}
              </nav>
            </div>

            <div>
              <div className="rail-sep" />
              <div className="rail-cap">Próximamente</div>
              <div className="rail-nav">
                {(historias ? PRONTO : [...PRONTO, HISTORIAS_PRONTO]).map((i) => (
                  <span className="rl pronto" key={i.id} aria-disabled="true">
                    <i.icono /> {i.texto}
                    <span className="rl-pronto">Pronto</span>
                  </span>
                ))}
              </div>
            </div>
          </>
        )}

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
            <GlifoWhatsapp />
            Escribinos
          </a>

          <div className="me-fila">
            <button type="button" className="me" onClick={abrirPerfil} aria-label="Abrir tu perfil">
              <span className="me-av">
                {perfil.foto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={perfil.foto} alt="" />
                ) : (
                  iniciales
                )}
              </span>
              <span className="me-txt">
                <b>{nombre}</b>
                <span>encontrate.app/{slug}</span>
              </span>
            </button>
            <form action={cerrarSesionAction}>
              <button
                type="submit"
                className="btn btn-ghost btn-icon me-salir"
                aria-label="Cerrar sesión"
                data-tip="Cerrar sesión"
              >
                <LogOut />
              </button>
            </form>
          </div>
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
            <span className="ico ico-menu">
              <Menu />
            </span>
            <span className="ico ico-close">
              <X />
            </span>
          </button>

          {/* La marca, sólo cuando el riel se esconde. El CSS la prende en el
              mismo corte que la hamburguesa: en escritorio ya está arriba del
              riel y repetirla sería decir lo mismo dos veces. */}
          <Link href="/dashboard" className="mark-ico" aria-label="encontrate.app" prefetch />

          <Buscador
            placeholder={admin ? "Buscar en tus eventos y ventas" : (BUSCAR[actual] ?? "Buscar evento, dorsal o venta")}
          />

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
            {admin ? (
              <Link href="/dashboard" className="btn btn-pri" prefetch>
                <LayoutGrid /> Mi panel
              </Link>
            ) : (
              <Link href="/dashboard/nuevo" className="btn btn-pri" prefetch>
                <Plus /> Nuevo evento
              </Link>
            )}
          </div>
        </header>

        {children}
      </div>

      {/* Acá y no en la página de inicio: la venta entra igual mientras el
          fotógrafo está subiendo fotos a un evento, que es cuando más pasa. */}
      <VentasEnVivo />

      <div className="rail-scrim" onClick={() => setCajon(false)} />

      {verPerfil && <PerfilModal perfil={perfil} onCerrar={cerrarPerfil} />}
      <Suspense fallback={null}>
        <PerfilDesdeUrl abrir={abrirPerfil} />
      </Suspense>
    </div>
  );
}
