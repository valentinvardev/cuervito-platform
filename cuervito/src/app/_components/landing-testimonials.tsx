type Testimonial = {
  /** Textual, sin editar. Si hay que "mejorarlo", no sirve como prueba. */
  quote: string;
  name: string;
  /** Evento o rubro concreto: "Maratón de Rosario", "Trail Córdoba". */
  role: string;
};

/**
 * Prueba social.
 *
 * Vacío a propósito: la sección no se renderiza hasta que haya testimonios
 * reales, con nombre y evento verificables. Un testimonio inventado es la
 * forma más rápida de perder al fotógrafo que sí iba a comprar — y acá el
 * visitante puede cruzar cualquier nombre contra el storefront público.
 *
 * Para activarla: agregá 2-3 entradas y listo.
 */
const TESTIMONIALS: Testimonial[] = [];

export function LandingTestimonials() {
  if (TESTIMONIALS.length === 0) return null;

  return (
    <section className="section" id="testimonios">
      <div className="container">
        <div className="section-head reveal">
          <span className="eyebrow">
            <i className="ti ti-quote" style={{ fontSize: 14 }} />
            Fotógrafos que ya venden acá
          </span>
          <h2 className="h-section">No se lo tomes a Cuervito.</h2>
        </div>
        <div className="testimonial-grid">
          {TESTIMONIALS.map((t) => (
            <article key={t.name} className="testimonial reveal">
              <p className="testimonial-quote">“{t.quote}”</p>
              <div className="testimonial-author">
                <span className="avatar">{t.name.charAt(0)}</span>
                <div>
                  <div className="name">{t.name}</div>
                  <div className="role">{t.role}</div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
