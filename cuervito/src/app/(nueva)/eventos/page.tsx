import { type Metadata } from "next";

import Link from "next/link";

import { searchLiveEvents } from "~/app/_components/live-events-actions";
import { auth } from "~/server/auth";
import { combosConPaginas } from "~/server/listados";

import { Pie } from "../_pie";
import { Encabezado } from "../_piezas";
import { BuscadorEventos } from "./_buscador";

export const metadata: Metadata = {
  title: "Buscá las fotos de tu carrera · encontrate.app",
  description:
    "Elegí tu evento y encontrá tus fotos por número de dorsal o con una selfie. Comprás y descargás al instante, sin crear cuenta.",
  alternates: { canonical: "/eventos" },
};

/**
 * La página del atleta: elegir el evento y entrar a buscar sus fotos.
 *
 * Vive adentro de (nueva) para tener la marca de la landing —sus tokens, su
 * encabezado, su pie— y no la del prototipo de cuervito, que es lo que
 * cargaba cuando era una ruta suelta: otra tipografía, otro logo y cien
 * kilobytes de CSS de otra marca. La dirección sigue siendo /eventos.
 *
 * Como ruta propia funciona para compartir por WhatsApp y para que Google la
 * indexe por su cuenta.
 */
export default async function EventosPage() {
  // La primera lista viene con la página y no la pide el navegador al
  // cargar: si esa llamada fallaba —un reinicio en pleno deploy, una pestaña
  // vieja—, la página entera caía en "Application error". Si falla acá, el
  // buscador la vuelve a pedir y muestra el error en su lugar.
  const [sesion, iniciales, combos] = await Promise.all([
    auth().catch(() => null),
    searchLiveEvents("").catch(() => null),
    // Las páginas por disciplina y provincia que existen: links desde acá es
    // como Google las encuentra. Si falla, la página sigue sin ellos.
    combosConPaginas().catch(() => ({ disciplinas: [], provincias: [] })),
  ]);
  const filtros = [...combos.disciplinas, ...combos.provincias];

  return (
    <>
      <Encabezado logueado={!!sesion?.user} />

      <header className="hero evs-hero">
        <div className="wrap">
          <span className="label eyebrow">Para atletas</span>
          <h1>
            Elegí tu evento.
            <br />
            <em>Encontrate.</em>
          </h1>
          <p className="lede">
            Buscá por nombre, ciudad o disciplina. Adentro encontrás tus fotos con tu número de
            dorsal o con una selfie, que no se guarda. Las comprás y las bajás al instante, sin
            crear cuenta.
          </p>
          {filtros.length > 0 && (
            <nav className="evs-filtros" aria-label="Por disciplina y provincia">
              {filtros.map((c) => (
                <Link key={`${c.tipo}-${c.slug}`} href={`/eventos/${c.slug}`}>
                  {c.nombre} <span>{c.eventos}</span>
                </Link>
              ))}
            </nav>
          )}
        </div>
      </header>

      <section className="evs-lista">
        <div className="wrap">
          <BuscadorEventos iniciales={iniciales} />
        </div>
      </section>

      <Pie />
    </>
  );
}
