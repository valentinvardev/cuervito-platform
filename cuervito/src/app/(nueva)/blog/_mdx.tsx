import { ArrowRight, Info, Search } from "lucide-react";
import Link from "next/link";
import { type ComponentPropsWithoutRef, type ReactNode } from "react";

import { COMISION } from "~/lib/producto";

import { Buscarse } from "./_ilustraciones/buscarse";
import { Calculadora } from "./_ilustraciones/calculadora";
import { PuntosDeCobertura } from "./_ilustraciones/cobertura";
import { DivisionCobro } from "./_ilustraciones/division-cobro";
import { Pasos } from "./_ilustraciones/pasos";

/**
 * Lo que un post puede usar además de markdown.
 *
 * La idea del blog es que cada artículo termine en algo que el lector puede
 * hacer ahí mismo —buscar sus fotos, crear la cuenta, ver la demo—, no en un
 * «gracias por leer». Por eso los llamados son componentes y no links sueltos:
 * el texto y el destino se deciden una vez, acá.
 *
 * El MDX no puede correr JavaScript (next-mdx-remote lo bloquea), así que todo
 * lo que haga falta calcular entra como componente: <Comision /> en vez de
 * escribir «10%» a mano en cada post.
 */

function Enlace({ href = "", children, ...resto }: ComponentPropsWithoutRef<"a">) {
  if (href.startsWith("/") || href.startsWith("#")) {
    return (
      <Link href={href} {...resto}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} target="_blank" rel="noopener" {...resto}>
      {children}
    </a>
  );
}

/** Las tablas anchas se scrollean solas en el teléfono, sin correr la página. */
function Tabla(props: ComponentPropsWithoutRef<"table">) {
  return (
    <div className="prosa-tabla">
      <table {...props} />
    </div>
  );
}

/** Un dato o una advertencia que no puede perderse en el párrafo. */
function Nota({ titulo, children }: { titulo?: string; children: ReactNode }) {
  return (
    <aside className="prosa-nota">
      <Info aria-hidden="true" />
      <div>
        {titulo && <b>{titulo}</b>}
        {children}
      </div>
    </aside>
  );
}

/** La comisión vigente. `sin` es la de los eventos sin reconocimiento. */
function Comision({ sin }: { sin?: boolean }) {
  return <>{sin ? COMISION.sinReconocimiento : COMISION.conReconocimiento}%</>;
}

const LLAMADOS = {
  fotografos: {
    titulo: "Probalo con tu próximo evento",
    texto: `Subís las fotos y la página de venta se arma sola, con búsqueda por cara y número. Sin cuota mensual: ${COMISION.conReconocimiento}% sólo cuando vendés.`,
    principal: { href: "/signup", txt: "Crear mi cuenta gratis" },
    secundario: { href: "/demo/subida", txt: "Ver cómo se sube un evento" },
  },
  atletas: {
    titulo: "¿Corriste hace poco?",
    texto: "Elegí tu evento y encontrate con tu número de dorsal o con una selfie. Comprás y descargás al instante, sin crear cuenta.",
    principal: { href: "/eventos", txt: "Buscar mis fotos" },
    secundario: null,
  },
} as const;

/** El cierre de acción. `para` elige a quién le habla. */
export function Llamado({ para }: { para: keyof typeof LLAMADOS }) {
  const l = LLAMADOS[para] ?? LLAMADOS.fotografos;
  return (
    <aside className="blog-llamado">
      <div>
        <b>{l.titulo}</b>
        <p>{l.texto}</p>
      </div>
      <div className="blog-llamado-cta">
        <Link href={l.principal.href} className="btn btn-pri">
          {para === "atletas" && <Search />}
          {l.principal.txt} <ArrowRight className="go" />
        </Link>
        {l.secundario && (
          <Link href={l.secundario.href} className="btn btn-ghost">
            {l.secundario.txt}
          </Link>
        )}
      </div>
    </aside>
  );
}

export const componentesMdx = {
  a: Enlace,
  table: Tabla,
  Nota,
  Comision,
  Llamado,
  // Las ilustraciones: ver _ilustraciones/ y el README de content/blog.
  Buscarse,
  PuntosDeCobertura,
  DivisionCobro,
  Pasos,
  Calculadora,
};
