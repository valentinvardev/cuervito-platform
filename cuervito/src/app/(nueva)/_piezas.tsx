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
  TrendingUp,
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

/**
 * Cambiar entre claro y oscuro.
 *
 * `js-tema` no es un gancho de JavaScript acá —el click se engancha por
 * props— pero la clase NO se puede sacar: el CSS la usa como excepción
 * (`.solo-ancho:not(.js-tema)`) para que entre 700 y 920px se escondan las
 * cosas de pantalla ancha menos este botón. Sin ella, el interruptor de tema
 * desaparece 220px antes de lo que corresponde.
 */
function BotonTema({ className = "" }: { className?: string }) {
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
      className={`btn btn-ghost btn-icon js-tema ${className}`.trim()}
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
 * La salida del atleta.
 *
 * Esta página es para el fotógrafo de punta a punta, pero a la home también
 * llega el que vino a buscar SUS fotos, y hasta ahora tenía un buscador en el
 * primer pixel. Sacándolo sin dejar nada, ese visitante se queda sin salida en
 * la única página que va a mirar. Un link alcanza: /eventos ya tiene la grilla
 * y el buscador.
 */
const BUSCAR = { href: "/eventos", txt: "Buscar mis fotos" } as const;

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
          <Link href="/" className="mark">
            encontrate<i></i>app
          </Link>

          <div className="nav-links">
            {ENLACES.map((e) => (
              <a key={e.href} href={e.href}>
                {e.txt}
              </a>
            ))}
            <Link href={BUSCAR.href}>{BUSCAR.txt}</Link>
          </div>

          <div className="nav-cta">
            <BotonTema className="solo-ancho" />

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
          {[...ENLACES, { href: "#demo", txt: "Ver un evento real" }, BUSCAR].map((e) => (
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
 * El video se pide recién cuando está por entrar en pantalla. Pesan casi tres
 * megas entre los dos y viven a dos scrolls de la portada: cargarlos al abrir
 * retrasa todo lo demás por algo que todavía no se ve.
 *
 * Se reproduce UNA vez y se queda en su última pantalla, la de confirmación.
 * En bucle el remate se perdía: el que llegaba a mirar se encontraba con el
 * arranque de la toma siguiente en vez de "¡Subiste tus fotos!".
 *
 * Con "reducir movimiento" prendido no se carga nunca y queda el poster, que
 * es un cuadro del mismo video. Un video que arranca solo es exactamente lo
 * que esa preferencia pide que no pase.
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
          // Ya terminó: se queda congelado en la confirmación. Llamar a play()
          // acá lo rebobinaría, que es justo lo que se sacó al quitar el loop.
          if (v.ended) continue;
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
          playsInline
          preload="none"
          aria-label={alt}
        />
      </div>
    </figure>
  );
}

type Venta = {
  /** Nombre de evento inventado. Ver el porqué en page.tsx. */
  evento: string;
  detalle: string;
  monto: string;
  foto: string | null;
};

/**
 * El panel de ventas, entrando.
 *
 * La tarjeta cuenta una historia —entra plata, el gráfico sube, caen ventas— y
 * quieta no la cuenta: se lee como una captura de algo que en el producto se
 * mueve. Acá se mueve.
 *
 * Arranca cuando la tarjeta entra en pantalla y no al cargar: vive a dos
 * scrolls de la portada, así que animándola al cargar el que llega ya se la
 * perdió. Y arranca UNA vez: repetirla en cada scroll la convierte en un
 * cartel parpadeante.
 *
 * El grueso lo hace el CSS a partir de dos atributos. Lo único que necesita
 * JavaScript de verdad es el número subiendo, que no se puede interpolar en
 * CSS sin trucos que dependen del navegador.
 */
export function PanelVentas({
  total,
  comparacion,
  ventas,
}: {
  /** El total de arriba, en pesos y sin símbolo. */
  total: number;
  comparacion: string;
  ventas: Venta[];
}) {
  const caja = useRef<HTMLElement>(null);
  const cifra = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = caja.current;
    const num = cifra.current;
    if (!el || !num) return;

    // Sin JavaScript nada de esto corre y la tarjeta se ve completa y quieta,
    // que es un final perfectamente bueno. Este atributo es el que habilita al
    // CSS a esconder cosas para revelarlas después.
    el.dataset.anim = "1";

    const quieto = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (quieto || !("IntersectionObserver" in window)) {
      el.dataset.visible = "1";
      return;
    }

    num.textContent = "0";
    let cuadro = 0;

    const mirón = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          if (!e.isIntersecting) continue;
          mirón.disconnect();
          el.dataset.visible = "1";

          const desde = performance.now();
          const dura = 1000;
          const paso = (ahora: number) => {
            const t = Math.min(1, (ahora - desde) / dura);
            // Desacelera al final: el número frena antes de llegar, que es lo
            // que hace que se lea el valor en vez de verse un borrón.
            const suave = 1 - Math.pow(1 - t, 3);
            num.textContent = Math.round(total * suave).toLocaleString("es-AR");
            if (t < 1) cuadro = requestAnimationFrame(paso);
          };
          cuadro = requestAnimationFrame(paso);
        }
      },
      { threshold: 0.35 },
    );
    mirón.observe(el);

    return () => {
      mirón.disconnect();
      cancelAnimationFrame(cuadro);
    };
  }, [total]);

  return (
    <aside className="panel" ref={caja}>
      <header className="panel-head">
        <div>
          <span className="label">Ventas</span>
          <div className="panel-when">Hoy</div>
        </div>
        {/* Los números son inventados y la tarjeta lo dice. */}
        <span className="tag">Ejemplo</span>
      </header>

      <div className="panel-figure">
        <div className="panel-amount">
          <span className="cur">$</span>
          <span ref={cifra}>{total.toLocaleString("es-AR")}</span>
        </div>
        <div className="panel-cmp">
          <span className="delta up">
            <TrendingUp />
            18%
          </span>
          <span>{comparacion}</span>
        </div>
      </div>

      {/* Sparkline de 7 días. Segmentos rectos, no curva suavizada: la curva
          inventa valores entre puntos y esto se lee como un dato. */}
      <figure className="spark">
        <svg viewBox="0 0 280 64" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
              <stop className="s0" offset="0%" />
              <stop className="s1" offset="100%" />
            </linearGradient>
          </defs>
          <path
            className="area"
            d="M8 49.8L52 40.2L96 54L140 32.3L184 43.4L228 21L272 10L272 64L8 64Z"
          />
          <path className="line" d="M8 49.8L52 40.2L96 54L140 32.3L184 43.4L228 21L272 10" />
        </svg>
        <span className="spark-dot" />
        <figcaption>
          {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </figcaption>
      </figure>

      <div className="panel-sec">
        <span className="label">Últimas ventas</span>
      </div>

      {ventas.map((v, i) => (
        <div
          className={`tx${i === 0 ? " nueva" : ""}`}
          key={v.evento}
          style={{ ["--i" as string]: i }}
        >
          <span className="tx-thumb">
            {v.foto && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={v.foto} alt="" loading="lazy" />
            )}
          </span>
          <div className="info">
            <div className="t">{v.evento}</div>
            <div className="s">{v.detalle}</div>
          </div>
          <div className="a">{v.monto}</div>
        </div>
      ))}
    </aside>
  );
}
