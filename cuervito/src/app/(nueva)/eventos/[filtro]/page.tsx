import { type Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { disciplinaDeSlug } from "~/lib/disciplinas";
import { auth } from "~/server/auth";
import { comboDe, cruces, eventosDe, type Combo } from "~/server/listados";

import { Pie } from "../../_pie";
import { Encabezado } from "../../_piezas";
import { TarjetaEvento } from "../_tarjeta";

/**
 * /eventos/running, /eventos/cordoba: los eventos de una disciplina o de
 * una provincia.
 *
 * Es la página para «fotos trail córdoba» o «fotos de running en rosario»,
 * búsquedas que hasta ahora no tenían adónde caer. Sale entera de los datos
 * de los eventos (ver server/listados): no hay texto escrito a mano, así
 * que cuando cambian los eventos cambia la página.
 *
 * Si el combo no llega al mínimo de eventos, 404: nunca una página vacía.
 */
type Props = { params: Promise<{ filtro: string }> };

function titulo(c: Combo): string {
  return c.tipo === "disciplina" ? `Fotos de ${c.nombre.toLowerCase()}` : `Fotos de carreras y partidos en ${c.nombre}`;
}

function parrafo(c: Combo): string {
  const desde = c.desde ? ` desde ${c.desde.getUTCFullYear()}` : "";
  const que = c.tipo === "disciplina" ? `eventos de ${c.nombre.toLowerCase()}` : `eventos deportivos en ${c.nombre}`;
  return `${c.eventos} ${que}${desde}, con ${c.fotos.toLocaleString("es-AR")} fotos de ${c.fotografos} ${
    c.fotografos === 1 ? "fotógrafo" : "fotógrafos"
  }. En cada galería buscás las tuyas por número de dorsal o con una selfie, y las comprás y descargás al instante, sin crear cuenta.`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { filtro } = await params;
  const c = await comboDe(filtro);
  if (!c) return {};
  const t = `${titulo(c)} · ${c.eventos} eventos · encontrate.app`;
  return {
    title: t,
    description: parrafo(c),
    alternates: { canonical: `/eventos/${c.slug}` },
    openGraph: { type: "website", title: t, description: parrafo(c) },
  };
}

export default async function EventosPorFiltro({ params }: Props) {
  const { filtro } = await params;
  const c = await comboDe(filtro);
  if (!c) notFound();

  const [sesion, eventos, relacionados] = await Promise.all([
    auth().catch(() => null),
    eventosDe(c.tipo === "disciplina" ? { disciplina: disciplinaDeSlug(c.slug)! } : { provincia: c.nombre }),
    cruces(c),
  ]);

  return (
    <>
      <Encabezado logueado={!!sesion?.user} />

      <header className="hero evs-hero">
        <div className="wrap">
          <span className="label eyebrow">{c.tipo === "disciplina" ? "Por disciplina" : "Por provincia"}</span>
          <h1>
            {c.tipo === "disciplina" ? (
              <>
                Fotos de <em>{c.nombre.toLowerCase()}.</em>
              </>
            ) : (
              <>
                Carreras y partidos en <em>{c.nombre}.</em>
              </>
            )}
          </h1>
          <p className="lede">{parrafo(c)}</p>
          {relacionados.length > 0 && (
            <nav className="evs-filtros" aria-label={c.tipo === "disciplina" ? "Por provincia" : "Por disciplina"}>
              {relacionados.map((r) => (
                <Link key={r.slug} href={`/eventos/${r.slug}`}>
                  {r.nombre} <span>{r.eventos}</span>
                </Link>
              ))}
              {c.tipo === "provincia" && <Link href={`/fotografos/${c.slug}`}>Fotógrafos en {c.nombre}</Link>}
            </nav>
          )}
        </div>
      </header>

      <section className="evs-lista">
        <div className="wrap">
          <div className="evs-grilla">
            {eventos.map((e) => (
              <TarjetaEvento key={e.href} evento={e} />
            ))}
          </div>
          <p className="evs-volver">
            <Link href="/eventos">Todos los eventos →</Link>
          </p>
        </div>
      </section>

      <Pie />
    </>
  );
}
