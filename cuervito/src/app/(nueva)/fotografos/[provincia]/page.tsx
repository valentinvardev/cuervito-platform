import { type Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { auth } from "~/server/auth";
import { combosConPaginas, cruces, fotografosDe, type Combo } from "~/server/listados";

import { Pie } from "../../_pie";
import { Encabezado } from "../../_piezas";

/**
 * /fotografos/cordoba: los fotógrafos con eventos en una provincia.
 *
 * Es la búsqueda del organizador: «fotógrafo deportivo en Córdoba». La lista
 * sale de los eventos publicados, así que un fotógrafo aparece en la
 * provincia donde trabaja de verdad, no en la que puso en el perfil. Mismo
 * mínimo que las páginas de eventos: sin tres eventos en la provincia, 404.
 */
type Props = { params: Promise<{ provincia: string }> };

async function provinciaDe(slug: string): Promise<Combo | null> {
  const { provincias } = await combosConPaginas();
  return provincias.find((p) => p.slug === slug) ?? null;
}

function parrafo(c: Combo, n: number): string {
  return `${n} ${n === 1 ? "fotógrafo deportivo" : "fotógrafos deportivos"} con eventos en ${c.nombre}: ${c.eventos} eventos y ${c.fotos.toLocaleString(
    "es-AR",
  )} fotos publicadas en encontrate.app. Cada uno cubre carreras y partidos, sube las fotos el mismo día y cobra en su propio Mercado Pago.`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { provincia } = await params;
  const c = await provinciaDe(provincia);
  if (!c) return {};
  const t = `Fotógrafos deportivos en ${c.nombre} · encontrate.app`;
  return {
    title: t,
    description: parrafo(c, c.fotografos),
    alternates: { canonical: `/fotografos/${c.slug}` },
    openGraph: { type: "website", title: t, description: parrafo(c, c.fotografos) },
  };
}

export default async function FotografosPorProvincia({ params }: Props) {
  const { provincia } = await params;
  const c = await provinciaDe(provincia);
  if (!c) notFound();

  const [sesion, fotografos, disciplinas] = await Promise.all([
    auth().catch(() => null),
    fotografosDe({ provincia: c.nombre }),
    cruces(c),
  ]);

  return (
    <>
      <Encabezado logueado={!!sesion?.user} />

      <header className="hero evs-hero">
        <div className="wrap">
          <span className="label eyebrow">Para organizadores</span>
          <h1>
            Fotógrafos deportivos en <em>{c.nombre}.</em>
          </h1>
          <p className="lede">{parrafo(c, fotografos.length)}</p>
          <nav className="evs-filtros" aria-label="Más">
            <Link href={`/eventos/${c.slug}`}>
              Eventos en {c.nombre} <span>{c.eventos}</span>
            </Link>
            {disciplinas.map((d) => (
              <Link key={d.slug} href={`/eventos/${d.slug}`}>
                {d.nombre} <span>{d.eventos}</span>
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <section className="evs-lista">
        <div className="wrap">
          <div className="fg-lista">
            {fotografos.map((f) => (
              <Link key={f.slug} href={`/${f.slug}`} className="fg">
                <b>{f.nombre}</b>
                <span>
                  {f.eventos} {f.eventos === 1 ? "evento" : "eventos"} · {f.fotos.toLocaleString("es-AR")} fotos
                  {f.disciplinas.length > 0 && ` · ${f.disciplinas.join(", ")}`}
                </span>
                <em>Ver sus eventos →</em>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <Pie />
    </>
  );
}
