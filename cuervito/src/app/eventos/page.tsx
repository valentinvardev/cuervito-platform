import "~/styles/prototype/styles.css";
import "~/styles/prototype/panel-anim.css";
import "~/styles/prototype/landing.css";

import { type Metadata } from "next";
import Link from "next/link";

import { ExternalStylesheets } from "../_components/external-stylesheets";
import { LiveEventsSearch } from "../_components/live-events-search";
import { RevealOnScroll } from "../_components/reveal-on-scroll";
import { ThemeToggle } from "../_components/theme-toggle";

export const metadata: Metadata = {
  title: "Buscá las fotos de tu carrera · Cuervito",
  description:
    "Elegí tu evento y encontrá tus fotos por número de dorsal o con una selfie. Comprás y descargás al instante, sin crear cuenta.",
  alternates: { canonical: "/eventos" },
};

/**
 * La página del atleta.
 *
 * Antes esto era una sección al pie de la home, cinco pantallas debajo del
 * CTA que prometía llevar hasta acá. Como ruta propia además funciona para
 * compartir por WhatsApp y para que Google la indexe por su cuenta.
 */
export default function EventosPage() {
  return (
    <div className="lp">
      <RevealOnScroll />
      <ExternalStylesheets />

      <nav className="nav">
        <div className="container nav-inner">
          <Link href="/" className="logo">
            cuerv<span className="logo-dot"></span>to
          </Link>
          <div className="nav-cta">
            <ThemeToggle />
            <Link href="/signup" className="btn btn-outline">
              Soy fotógrafo
            </Link>
          </div>
        </div>
      </nav>

      <section className="eventos-hero">
        <div className="container">
          <div className="le-head">
            <span className="eyebrow">
              <i className="ti ti-calendar-event" style={{ fontSize: 14 }}></i>
              Eventos
            </span>
            <h1 className="h-section">Elegí tu evento.</h1>
            <p>
              Filtrá por nombre, ciudad o disciplina. Adentro buscás tus fotos
              por número de dorsal o subiendo una selfie — y la selfie no se
              guarda.
            </p>
          </div>
          <LiveEventsSearch />
        </div>
      </section>

      <footer className="footer">
        <div className="container">
          <div className="footer-bottom" style={{ borderTop: "none" }}>
            <span>© 2026 cuervito.app · Hecho en Argentina</span>
            <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
              <Link href="/terminos" className="footer-legal-link">
                Términos
              </Link>
              <Link href="/privacidad" className="footer-legal-link">
                Privacidad
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
