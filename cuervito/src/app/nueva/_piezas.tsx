"use client";

import Link from "next/link";
import {
  ArrowRight,
  Eye,
  LayoutDashboard,
  LogIn,
  Menu as IconoMenu,
  Moon,
  Sun,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * Las partes de la landing que necesitan al navegador.
 *
 * Todo lo demás de esta pantalla es HTML servido: los textos, el precio, las
 * preguntas. Acá sólo está lo que no se puede hacer sin JavaScript —el menú de
 * mobile, el acordeón que anima su altura, el video que se carga tarde— para
 * que el resto llegue como HTML y se vea antes de que cargue nada.
 */

/** Cambiar entre claro y oscuro. */
function BotonTema() {
  /**
   * data-theme vale "light" o "dark", nunca otra cosa.
   *
   * Es la misma política que el script del layout raíz, que ya resolvió el
   * tema antes de pintar. Escribir "" acá rompería el interruptor del panel
   * viejo, que lee `dataset.theme === "light" ? "light" : "dark"` y con ""
   * se convence de estar en oscuro estando en claro.
   */
  function cambiar() {
    const raiz = document.documentElement;
    const proximo = raiz.dataset.theme === "dark" ? "light" : "dark";
    raiz.dataset.theme = proximo;
    try {
      localStorage.setItem("cuervito-theme", proximo);
    } catch {
      // almacenamiento bloqueado: el tema dura lo que dure la pestaña
    }
  }

  return (
    <button
      type="button"
      className="btn btn-ghost btn-icon"
      onClick={cambiar}
      aria-label="Cambiar tema"
    >
      <span className="ico ico-moon">
        <Moon />
      </span>
      <span className="ico ico-sun">
        <Sun />
      </span>
    </button>
  );
}

const ENLACES = [
  { href: "#como", txt: "Cómo funciona" },
  { href: "#precio", txt: "Precio" },
  { href: "#preguntas", txt: "Preguntas" },
] as const;

/**
 * La barra de arriba con su cajón de mobile.
 *
 * Va entero en un componente de cliente, incluido el velo y el cajón, aunque
 * en el prototipo son tres nodos separados del DOM. Separarlos acá obligaría a
 * que el botón y el velo se pusieran de acuerdo a través del atributo del
 * <html>, y alcanzaría con cerrar desde el velo para que el botón siguiera
 * creyendo que está abierto y su aria-expanded mintiera.
 *
 * El atributo del <html> se sigue escribiendo igual, porque de ahí cuelga en
 * el CSS todo lo que se mueve: el cajón entrando, el velo apareciendo y el
 * ícono de la hamburguesa girando hasta ser una cruz.
 */
export function Encabezado({ logueado }: { logueado: boolean }) {
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.menu = abierto ? "open" : "";
    return () => {
      document.documentElement.dataset.menu = "";
    };
  }, [abierto]);

  // Escape cierra, que es lo primero que prueba cualquiera.
  useEffect(() => {
    if (!abierto) return;
    const alTecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
    };
    window.addEventListener("keydown", alTecla);
    return () => window.removeEventListener("keydown", alTecla);
  }, [abierto]);

  return (
    <>
      <nav className="nav">
        <div className="wrap nav-in">
          <Link href="/nueva" className="mark">
            encontrate<i></i>app
          </Link>

          <div className="nav-links">
            {ENLACES.map((e) => (
              <a key={e.href} href={e.href}>
                {e.txt}
              </a>
            ))}
          </div>

          <div className="nav-cta">
            <span className="solo-ancho">
              <BotonTema />
            </span>

            {logueado ? (
              <Link href="/dashboard" className="btn btn-pri">
                <LayoutDashboard /> Ir al panel
              </Link>
            ) : (
              <>
                <Link href="/login" className="btn btn-ghost solo-ancho">
                  <LogIn /> Iniciar sesión
                </Link>
                <Link href="/signup" className="btn btn-pri">
                  Empezar <ArrowRight className="go" />
                </Link>
              </>
            )}

            <button
              type="button"
              className="btn btn-ghost btn-icon burger"
              aria-label={abierto ? "Cerrar menú" : "Abrir menú"}
              aria-expanded={abierto}
              aria-controls="menu"
              onClick={() => setAbierto((v) => !v)}
            >
              <span className="ico ico-menu">
                <IconoMenu />
              </span>
              <span className="ico ico-close">
                <X />
              </span>
            </button>
          </div>
        </div>
      </nav>

      {/* El velo va aparte del cajón para poder desenfocar el fondo sin
          desenfocar también el contenido del menú. */}
      <div className="scrim" hidden={!abierto} onClick={() => setAbierto(false)} />

      <aside className="drawer" id="menu" aria-label="Menú">
        <nav className="drawer-links">
          {[...ENLACES, { href: "#demo", txt: "Ver un evento real" }].map((e) => (
            <a key={e.href} href={e.href} onClick={() => setAbierto(false)}>
              {e.txt} <ArrowRight />
            </a>
          ))}
        </nav>
        <div className="drawer-foot">
          {logueado ? (
            <Link href="/dashboard" className="btn btn-ghost">
              <LayoutDashboard /> Ir al panel
            </Link>
          ) : (
            <Link href="/login" className="btn btn-ghost">
              <LogIn /> Iniciar sesión
            </Link>
          )}
          <BotonTema />
        </div>
      </aside>
    </>
  );
}

/** Un enlace del hero que además existe en el cajón. */
export function VerEvento({ href }: { href: string }) {
  return (
    <a href={href} className="btn btn-ghost">
      <Eye /> Ver un evento real
    </a>
  );
}

type Pregunta = { p: string; r: string };

/**
 * Las preguntas, con el acordeón animado.
 *
 * <details> no anima solo: al cerrar, el navegador saca el contenido del flujo
 * antes de que corra la transición, así que el cierre era instantáneo por más
 * transición que tuviera. Se intercepta el click, se anima la altura a mano en
 * píxeles —`auto` no se puede interpolar— y recién ahí se toca el atributo.
 */
export function Preguntas({ items }: { items: Pregunta[] }) {
  return (
    <div className="faq">
      {items.map((q, i) => (
        <Qa key={q.p} pregunta={q} abierta={i === 0} />
      ))}
    </div>
  );
}

function Qa({ pregunta, abierta }: { pregunta: Pregunta; abierta: boolean }) {
  const det = useRef<HTMLDetailsElement>(null);
  const cuerpo = useRef<HTMLDivElement>(null);
  const ocupado = useRef(false);

  function alFinal(hacer: () => void) {
    const c = cuerpo.current;
    if (!c) return hacer();
    const fin = (e: TransitionEvent) => {
      if (e.propertyName !== "height") return;
      c.removeEventListener("transitionend", fin);
      hacer();
    };
    c.addEventListener("transitionend", fin);
  }

  return (
    <details
      className="qa"
      ref={det}
      open={abierta}
      onClick={(e) => {
        // Sólo el resumen abre y cierra; un click en el texto de la respuesta
        // no tiene por qué cerrarla.
        if (!(e.target as HTMLElement).closest("summary")) return;
        e.preventDefault();
        const d = det.current;
        const c = cuerpo.current;
        if (!d || !c || ocupado.current) return;
        ocupado.current = true;
        const listo = () => {
          c.style.height = "";
          ocupado.current = false;
        };

        if (d.open) {
          d.classList.remove("is-open");
          c.style.height = c.scrollHeight + "px";
          // Reflow forzado. Sin esto el navegador nunca llega a computar la
          // altura en píxeles y pasa de `auto` a 0 de un salto.
          void c.offsetHeight;
          requestAnimationFrame(() => {
            c.style.height = "0px";
          });
          alFinal(() => {
            d.open = false;
            listo();
          });
        } else {
          d.open = true;
          d.classList.add("is-open");
          const h = c.scrollHeight;
          c.style.height = "0px";
          void c.offsetHeight;
          requestAnimationFrame(() => {
            c.style.height = h + "px";
          });
          alFinal(listo);
        }
      }}
    >
      <summary>
        <span>{pregunta.p}</span>
      </summary>
      <div className="qa-body" ref={cuerpo}>
        <div>
          <p>{pregunta.r}</p>
        </div>
      </div>
    </details>
  );
}

/**
 * El teléfono con la captura del producto adentro.
 *
 * El video se pide recién cuando está por entrar en pantalla. Son cinco megas
 * entre los dos y viven a dos scrolls de la portada: cargarlos al abrir
 * retrasa todo lo demás por algo que todavía no se ve.
 *
 * Con "reducir movimiento" prendido no se carga nunca y queda el poster, que
 * es un cuadro del mismo video. Un video que arranca solo y se repite es
 * exactamente lo que esa preferencia pide que no pase.
 */
export function Telefono({ nombre, alt }: { nombre: "compra" | "subida"; alt: string }) {
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!("IntersectionObserver" in window)) return;

    const mirón = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          if (!e.isIntersecting) {
            v.pause();
            continue;
          }
          if (!v.getAttribute("src")) v.src = `/demo/${nombre}.mp4`;
          // El play puede rebotar (batería baja, ahorro de datos). No es un
          // error: queda el poster, que es una captura del mismo video.
          void v.play().catch(() => undefined);
        }
      },
      { rootMargin: "300px 0px" },
    );
    mirón.observe(v);
    return () => mirón.disconnect();
  }, [nombre]);

  return (
    <figure className="tel">
      <span className="tel-b tel-b-izq tel-b-accion" />
      <span className="tel-b tel-b-izq tel-b-vol-mas" />
      <span className="tel-b tel-b-izq tel-b-vol-menos" />
      <span className="tel-b tel-b-der tel-b-bloqueo" />
      <span className="tel-b tel-b-der tel-b-camara" />
      <div className="tel-vidrio">
        <video
          ref={video}
          poster={`/demo/${nombre}.jpg`}
          muted
          loop
          playsInline
          preload="none"
          aria-label={alt}
        />
      </div>
    </figure>
  );
}
