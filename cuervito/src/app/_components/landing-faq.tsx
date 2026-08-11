import { whatsappUrl } from "~/lib/support";

type Item = { q: string; a: React.ReactNode };

/**
 * Las objeciones que se hace un fotógrafo antes de mover su evento a otra
 * plataforma. Todas las respuestas describen cómo funciona hoy el producto.
 *
 * Falta una, y es la primera que va a preguntar un monotributista: quién le
 * factura al comprador y cómo queda ante ARCA. No la contesto acá porque no
 * es una respuesta de producto — definila con tu contador y agregala.
 */
const ITEMS: Item[] = [
  {
    q: "¿Cuándo cobro?",
    a: (
      <>
        En el momento de la venta. El pago del atleta entra{" "}
        <strong>directo a tu cuenta de Mercado Pago</strong> y nosotros
        retenemos el 10% en la misma operación. No hay retiros, ni mínimos, ni
        esperar treinta días: Cuervito nunca tiene tu plata.
      </>
    ),
  },
  {
    q: "¿Cuánto cuesta?",
    a: (
      <>
        Nada por mes y nada de alta. 10% por venta. Si un mes no vendés, pagás
        cero.
      </>
    ),
  },
  {
    q: "¿El atleta tiene que crearse una cuenta?",
    a: (
      <>
        No. Compra con su email y descarga con un link, sin registrarse. Cada
        paso que le sacás al comprador es plata que no perdés.
      </>
    ),
  },
  {
    q: "¿Sirve si en mi deporte no hay dorsal?",
    a: (
      <>
        Sí. El reconocimiento facial funciona igual, y el atleta también puede
        recorrer la galería completa del evento y filtrar a mano.
      </>
    ),
  },
  {
    q: "¿Qué pasa con la selfie que sube el atleta?",
    a: (
      <>
        Se usa para buscar y se descarta. <strong>No la guardamos</strong>: no
        va a nuestro storage ni a la base de datos.
      </>
    ),
  },
  {
    q: "¿Cuánto puedo subir?",
    a: (
      <>
        100 GB, eventos ilimitados y hasta 50 MB por foto. El original queda
        guardado intacto: la marca de agua va sólo en las previews, y el
        comprador se lleva la foto limpia.
      </>
    ),
  },
  {
    q: "¿Puedo usar mi propia marca y mi dominio?",
    a: (
      <>
        Sí. Elegís una de las cuatro plantillas, tu color y tu logo, y podés
        apuntar tu dominio propio a tu galería. El atleta te compra a vos, no a
        una galería genérica con el logo de otro.
      </>
    ),
  },
  {
    q: "¿Puedo trabajar con otros fotógrafos en el mismo evento?",
    a: (
      <>
        Sí. Invitás colaboradores al evento y definís qué porcentaje se lleva
        cada uno; las comisiones se calculan solas en cada venta.
      </>
    ),
  },
  {
    q: "¿A quién le escribo si algo falla?",
    a: (
      <>
        A nosotros, por WhatsApp, a la hora que sea. Las carreras arrancan a
        las 7 de la mañana y terminan de noche, así que el soporte atiende{" "}
        <strong>las 24 horas</strong>.{" "}
        <a
          href={whatsappUrl("Hola, necesito ayuda con Cuervito.")}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "var(--accent)" }}
        >
          Escribinos ahora
        </a>
        .
      </>
    ),
  },
];

export function LandingFaq() {
  return (
    <section className="faq-section" id="preguntas">
      <div className="container faq-inner">
        <div className="faq-head reveal">
          <span className="eyebrow">
            <i className="ti ti-help-circle" style={{ fontSize: 14 }} />
            Preguntas
          </span>
          <h2 className="h-section">Lo que preguntan antes de mudarse.</h2>
        </div>

        <div className="faq-list reveal">
          {ITEMS.map((it) => (
            <details key={it.q} className="faq-item">
              <summary>
                <span>{it.q}</span>
                <i className="ti ti-plus" aria-hidden="true" />
              </summary>
              <div className="faq-answer">{it.a}</div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
