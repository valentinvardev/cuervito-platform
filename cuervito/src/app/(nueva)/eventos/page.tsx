import { type Metadata } from "next";
import Link from "next/link";

import { auth } from "~/server/auth";

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
  const sesion = await auth().catch(() => null);

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
        </div>
      </header>

      <section className="evs-lista">
        <div className="wrap">
          <BuscadorEventos />
        </div>
      </section>

      <footer>
        <div className="wrap foot">
          <span>© {new Date().getFullYear()} encontrate.app · Hecho en Argentina</span>
          <Link href="/terminos">Términos y privacidad</Link>
        </div>
      </footer>
    </>
  );
}
