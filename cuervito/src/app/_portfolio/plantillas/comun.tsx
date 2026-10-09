"use client";

/**
 * Lo que comparten Podio, Fotofinish y Sendero: el menú con foco atrapado, el
 * visor de fotos, el formulario de contacto, las entradas al hacer scroll y
 * los links del fotógrafo.
 *
 * Las tres primeras plantillas (las de photo-saas) traen cada una su copia de
 * esto. Las nuevas no: una regla —qué hace el formulario en modo WhatsApp,
 * cuándo se cierra el menú— vive acá una sola vez.
 */

import "./comun.css";

import { useEffect, useMemo, useRef, useState } from "react";

import { usuarioInstagram } from "~/lib/instagram";

import { agruparProyectos } from "../proyectos";
import { useEditorStore } from "../store";
import { campo, fillWaTemplate } from "../whatsapp";

/* ── Preferencias del visitante ─────────────────────────────────────────── */

function useMedia(consulta: string): boolean {
  const [si, setSi] = useState(false);
  useEffect(() => {
    const m = window.matchMedia(consulta);
    setSi(m.matches);
    const cambio = () => setSi(m.matches);
    m.addEventListener("change", cambio);
    return () => m.removeEventListener("change", cambio);
  }, [consulta]);
  return si;
}

/** «Reducir movimiento» del sistema: sin desplazamientos, sólo fundidos. */
export const useMovimientoReducido = () => useMedia("(prefers-reduced-motion: reduce)");

/** Un mouse o un trackpad. En pantallas táctiles no hay cursor que seguir. */
export const usePunteroFino = () => useMedia("(hover: hover) and (pointer: fine)");

/* ── Clic ───────────────────────────────────────────────────────────────── */

/**
 * Un link o un botón de verdad en el sitio, y un <span> en el editor: ahí un
 * clic tiene que seleccionar el texto, no navegar ni abrir el menú.
 */
export function Clic({
  href,
  alActivar,
  externo,
  className,
  style,
  etiqueta,
  expandido,
  children,
  ...datos
}: {
  href?: string | null;
  alActivar?: () => void;
  externo?: boolean;
  className?: string;
  style?: React.CSSProperties;
  etiqueta?: string;
  /** aria-expanded, para el botón que abre el menú. */
  expandido?: boolean;
  children: React.ReactNode;
} & Partial<Record<`data-${string}`, string | number>>) {
  const readOnly = useEditorStore((s) => s.readOnly);
  if (!readOnly) return <span className={className} style={style} {...datos}>{children}</span>;
  if (href) {
    return (
      <a
        href={href}
        className={className}
        style={style}
        aria-label={etiqueta}
        onClick={alActivar}
        {...(externo ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        {...datos}
      >
        {children}
      </a>
    );
  }
  return (
    <button
      type="button"
      className={className}
      style={style}
      aria-label={etiqueta}
      aria-expanded={expandido}
      onClick={alActivar}
      {...datos}
    >
      {children}
    </button>
  );
}

/* ── Texto de un nodo ───────────────────────────────────────────────────── */

const ENTIDADES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " " };

/** El texto de un nodo sin etiquetas: para el menú, una cinta, una cifra. */
export function aTexto(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m) => ENTIDADES[m] ?? m)
    .trim();
}

/** El contenido de un nodo ("" si no existe). */
export function useContenido(id: string): string {
  return useEditorStore((s) => s.nodes[id]?.content ?? "");
}

/** Si un nodo se ve: los datos vacíos ({fotos} en cero) quedan ocultos. */
export function useNodoVisible(id: string): boolean {
  return useEditorStore((s) => Boolean(s.nodes[id] && !s.nodes[id].hidden));
}

/**
 * Las líneas de un título (las corta el fotógrafo con Enter), para que cada
 * una entre por separado. Cada línea es HTML ya saneado al guardar.
 */
export function Lineas({ id, className }: { id: string; className: string }) {
  const html = useContenido(id);
  return (
    <>
      {html.split(/<br\s*\/?>/i).map((l, i) => (
        <span key={i} className={className} style={{ "--i": i } as React.CSSProperties}>
          <span dangerouslySetInnerHTML={{ __html: l }} />
        </span>
      ))}
    </>
  );
}

/**
 * Achica la letra de un texto de una sola línea hasta que entre en su caja:
 * el nombre del fotógrafo a todo el ancho, sea "Ana Paz" o uno de cuatro
 * palabras.
 */
export function useAjustarAncho(ref: React.RefObject<HTMLElement | null>, clave: unknown) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ajustar = () => {
      el.style.fontSize = "";
      const r = el.clientWidth / el.scrollWidth;
      if (r < 1) el.style.fontSize = `${Math.floor(parseFloat(getComputedStyle(el).fontSize) * r * 0.98)}px`;
    };
    ajustar();
    void document.fonts?.ready.then(ajustar);
    // Sólo cuando cambia el ancho: cambiar la letra cambia el alto, y mirar el
    // alto sería volver a llamarse para siempre.
    let ancho = el.parentElement?.clientWidth ?? 0;
    const ro = new ResizeObserver(() => {
      const nuevo = el.parentElement?.clientWidth ?? 0;
      if (nuevo === ancho) return;
      ancho = nuevo;
      ajustar();
    });
    if (el.parentElement) ro.observe(el.parentElement);
    return () => ro.disconnect();
  }, [ref, clave]);
}

/* ── Datos del sitio ────────────────────────────────────────────────────── */

/** Las fotos agrupadas por evento (ver ../proyectos.ts). */
export function useProyectos() {
  const fotos = useEditorStore((s) => s.galleryPhotos);
  return useMemo(() => agruparProyectos(fotos), [fotos]);
}

/** Si una sección se ve: el fotógrafo puede ocultarlas desde el editor. */
export function useSeccionVisible() {
  const ocultas = useEditorStore((s) => s.hiddenSections);
  return (id: string) => !ocultas.includes(id);
}

/**
 * Los links del fotógrafo, listos para un href, o null si no los cargó:
 * Instagram y web del perfil, WhatsApp si eligió recibir ahí las consultas,
 * y su tienda de encontrate.
 */
export function useEnlaces() {
  const perfil = useEditorStore((s) => s.perfil);
  const contacto = useEditorStore((s) => s.contact);
  const slug = useEditorStore((s) => s.siteSlug);
  return useMemo(() => {
    const ig = usuarioInstagram(perfil.instagram);
    const web = perfil.web?.trim();
    const numero = contacto.whatsapp.replace(/\D/g, "");
    return {
      instagram: ig ? `https://instagram.com/${ig}` : null,
      web: web ? (/^https?:\/\//.test(web) ? web : `https://${web}`) : null,
      whatsapp: contacto.mode === "whatsapp" && numero ? `https://wa.me/${numero}` : null,
      tienda: slug ? `/${slug}` : null,
    };
  }, [perfil.instagram, perfil.web, contacto.mode, contacto.whatsapp, slug]);
}

/** Lleva a una sección con scroll suave (o de golpe, con «reducir movimiento»). */
export function irA(id: string) {
  const reducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.getElementById(id)?.scrollIntoView({ behavior: reducido ? "auto" : "smooth", block: "start" });
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/**
 * Una fecha AAAA-MM-DD en partes. Se arma a mano y no con `new Date()`: la
 * fecha del evento se guarda a las 00:00 UTC, y pasada a la hora local de
 * Argentina caería el día anterior.
 */
export function partesFecha(iso: string | null | undefined) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  if (!m) return null;
  const mes = Number(m[2]) - 1;
  return { anio: m[1]!, mes: MESES[mes] ?? "", mesNum: m[2]!, dia: m[3]! };
}

/** 1204 → "1.204". */
export const miles = (n: number) => n.toLocaleString("es-AR");

/**
 * Una cifra de portada ("142", "12 mil", "1,2 M") partida en el número y lo
 * que lo rodea, para contarla desde cero sin perder el formato.
 */
export function partirCifra(texto: string) {
  const m = /^(\D*)(\d[\d.]*)(.*)$/.exec(texto);
  if (!m) return null;
  const n = Number(m[2]!.replace(/\./g, ""));
  return Number.isFinite(n) ? { antes: m[1]!, numero: n, despues: m[3]! } : null;
}

/* ── Entradas al hacer scroll ───────────────────────────────────────────── */

/**
 * Marca con `data-visto` cada elemento `[data-rv]` de la plantilla cuando
 * entra en pantalla; el CSS de cada plantilla decide cómo aparece.
 *
 * Lo que está oculto antes de entrar lo está sólo bajo `[data-anim]`, que se
 * pone recién al montar: la página que llega del servidor se ve completa (sin
 * JavaScript, o para quien la indexa), y lo que ya está en pantalla al cargar
 * se marca visto antes, así no parpadea. En el editor y con «reducir
 * movimiento» no se pone: todo se ve quieto.
 *
 * `clave` vuelve a buscar elementos cuando la plantilla agrega otros (un
 * filtro, "ver más").
 */
export function useRevelar(raiz: React.RefObject<HTMLElement | null>, clave: unknown = null) {
  const readOnly = useEditorStore((s) => s.readOnly);
  const reducido = useMovimientoReducido();

  useEffect(() => {
    const el = raiz.current;
    if (!el || !readOnly || reducido) {
      if (el) delete el.dataset.anim;
      return;
    }
    const pendientes = [...el.querySelectorAll<HTMLElement>("[data-rv]:not([data-visto])")];
    const alto = window.innerHeight;
    // Sólo en la primera pasada: lo que aparece después (un filtro) sí entra animado.
    const primera = el.dataset.anim === undefined;
    const io = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          if (!e.isIntersecting) continue;
          (e.target as HTMLElement).dataset.visto = "";
          io.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );
    for (const p of pendientes) {
      const r = p.getBoundingClientRect();
      if (primera && r.top < alto && r.bottom > 0) p.dataset.visto = "";
      else io.observe(p);
    }
    el.dataset.anim = "";
    return () => io.disconnect();
  }, [raiz, readOnly, reducido, clave]);
}

/* ── Menú ───────────────────────────────────────────────────────────────── */

/**
 * El menú hamburguesa: mientras está abierto la página no scrollea, Escape lo
 * cierra, el foco no se escapa del panel (Tab da la vuelta) y al cerrarse
 * vuelve al botón que lo abrió.
 *
 * El panel queda montado siempre, con `inert` cuando está cerrado, para que
 * pueda animarse al salir.
 */
export function useMenu() {
  const [abierto, setAbierto] = useState(false);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const previo = document.activeElement as HTMLElement | null;
    const html = document.documentElement;
    const overflow = html.style.overflow;
    html.style.overflow = "hidden";
    const focos = () =>
      [...(panel.current?.querySelectorAll<HTMLElement>("a[href], button:not([disabled])") ?? [])];
    const t = window.setTimeout(() => focos()[0]?.focus(), 60);
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
      if (e.key !== "Tab") return;
      const f = focos();
      if (f.length === 0) return;
      const i = f.indexOf(document.activeElement as HTMLElement);
      if (e.shiftKey && i <= 0) {
        e.preventDefault();
        f.at(-1)!.focus();
      } else if (!e.shiftKey && i === f.length - 1) {
        e.preventDefault();
        f[0]!.focus();
      }
    };
    document.addEventListener("keydown", tecla);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("keydown", tecla);
      html.style.overflow = overflow;
      previo?.focus();
    };
  }, [abierto]);

  return {
    abierto,
    panel,
    abrir: () => setAbierto(true),
    cerrar: () => setAbierto(false),
    /** Cierra el menú y lleva a la sección. */
    ir: (id: string) => {
      setAbierto(false);
      // Después de devolver el scroll a la página.
      window.setTimeout(() => irA(id), 30);
    },
  };
}

/* ── Formulario de contacto ─────────────────────────────────────────────── */

export type EstadoContacto = "listo" | "mandando" | "enviado" | "error";

/**
 * Lo que hace el formulario según lo que eligió el fotógrafo: abrir WhatsApp
 * con el mensaje armado, o mandar la consulta a su panel. En el editor no
 * hace nada, y en un borrador (sin `enviarConsulta`) finge que salió.
 */
export function useContacto() {
  const contacto = useEditorStore((s) => s.contact);
  const enviar = useEditorStore((s) => s.enviarConsulta);
  const readOnly = useEditorStore((s) => s.readOnly);
  const [estado, setEstado] = useState<EstadoContacto>("listo");

  async function alEnviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!readOnly) return;
    const fd = new FormData(e.currentTarget);
    const datos = { name: campo(fd, "name"), email: campo(fd, "email"), message: campo(fd, "message") };

    if (contacto.mode === "whatsapp") {
      const numero = contacto.whatsapp.replace(/\D/g, "");
      const texto = encodeURIComponent(fillWaTemplate(contacto.waTemplate, datos));
      window.open(numero ? `https://wa.me/${numero}?text=${texto}` : `https://wa.me/?text=${texto}`, "_blank", "noopener");
      setEstado("enviado");
      return;
    }
    if (!enviar) {
      setEstado("enviado");
      return;
    }
    try {
      setEstado("mandando");
      await enviar(datos);
      setEstado("enviado");
    } catch {
      setEstado("error");
    }
  }

  return { estado, alEnviar, porWhatsapp: contacto.mode === "whatsapp", readOnly };
}

/* ── Visor ──────────────────────────────────────────────────────────────── */

export type FotoVisor = { src: string; titulo?: string };

/**
 * Una foto a pantalla completa, con flechas, teclado y deslizar con el dedo.
 * Toma el acento de la plantilla de `--visor-acento`.
 */
export function Visor({
  fotos,
  inicio,
  alCerrar,
  className,
}: {
  fotos: FotoVisor[];
  inicio: number;
  alCerrar: () => void;
  className?: string;
}) {
  const [i, setI] = useState(inicio);
  const cerrar = useRef<HTMLButtonElement>(null);
  const toque = useRef<number | null>(null);
  const total = fotos.length;
  const ir = (d: number) => setI((x) => Math.min(Math.max(x + d, 0), total - 1));

  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null;
    const html = document.documentElement;
    const overflow = html.style.overflow;
    html.style.overflow = "hidden";
    cerrar.current?.focus();
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") alCerrar();
      if (e.key === "ArrowRight") setI((x) => Math.min(x + 1, total - 1));
      if (e.key === "ArrowLeft") setI((x) => Math.max(x - 1, 0));
      if (e.key === "Tab") {
        // Los únicos controles son los del visor.
        e.preventDefault();
        cerrar.current?.focus();
      }
    };
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("keydown", tecla);
      html.style.overflow = overflow;
      previo?.focus();
    };
  }, [alCerrar, total]);

  const f = fotos[i];
  if (!f) return null;
  return (
    <div
      className={`pf-visor ${className ?? ""}`}
      role="dialog"
      aria-modal="true"
      aria-label="Foto ampliada"
      onClick={(e) => {
        if (e.target === e.currentTarget) alCerrar();
      }}
      onTouchStart={(e) => {
        toque.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const x0 = toque.current;
        const x1 = e.changedTouches[0]?.clientX;
        toque.current = null;
        if (x0 == null || x1 == null || Math.abs(x1 - x0) < 40) return;
        ir(x1 < x0 ? 1 : -1);
      }}
    >
      <button ref={cerrar} type="button" className="pf-visor-cerrar" onClick={alCerrar}>
        Cerrar <span aria-hidden>✕</span>
      </button>
      {i > 0 && (
        <button type="button" className="pf-visor-flecha" data-lado="izq" onClick={() => ir(-1)} aria-label="Foto anterior">
          ←
        </button>
      )}
      {i < total - 1 && (
        <button type="button" className="pf-visor-flecha" data-lado="der" onClick={() => ir(1)} aria-label="Foto siguiente">
          →
        </button>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img key={f.src} src={f.src} alt={f.titulo ?? ""} className="pf-visor-foto" />
      {/* Las vecinas, cargadas de antemano para que pasar de foto no espere. */}
      {[fotos[i - 1], fotos[i + 1]].map((v) =>
        // eslint-disable-next-line @next/next/no-img-element
        v ? <img key={`pre-${v.src}`} src={v.src} alt="" hidden /> : null,
      )}
      <div className="pf-visor-pie">
        <span>
          {String(i + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
        </span>
        {f.titulo && <span className="pf-visor-titulo">{f.titulo}</span>}
      </div>
    </div>
  );
}
