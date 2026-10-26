import { LifeBuoy } from "lucide-react";

import { whatsappUrl } from "~/lib/support";

import { GlifoWhatsapp } from "../_components/glifo-whatsapp";
import { sesionPanel } from "../_components/sesion";
import { Faq } from "./_faq";
import { Guias } from "./_guias";

export const dynamic = "force-dynamic";

export default async function V2Ayuda() {
  await sesionPanel();

  return (
    <main className="canvas">
      <div className="canvas-in">
        <div className="head">
          <div>
            <h1>Ayuda</h1>
            <p>Escribinos cuando quieras, o mirá si tu pregunta ya está resuelta.</p>
          </div>
        </div>

        {/* El contacto va arriba y no al final. Para alguien que está subiendo
            fotos un domingo a la noche con el evento todavía caliente, una
            promesa de respuesta en horas hábiles equivale a no tener soporte:
            cuando le contesten, la venta ya no está. */}
        <section className="contacto">
          <div>
            <h2>
              <span className="ct-i">
                <LifeBuoy />
              </span>{" "}
              Escribinos por WhatsApp
            </h2>
            <p>
              Las 24 horas, todos los días, incluidos domingos y feriados. Si estás en medio de un
              evento y algo no anda, esta es la vía rápida.
            </p>
          </div>
          <a
            href={whatsappUrl()}
            target="_blank"
            rel="noopener"
            className="btn btn-wa btn-lg"
          >
            <GlifoWhatsapp />
            Abrir WhatsApp
          </a>
        </section>

        <section>
          <div className="card-h">
            <div>
              <h2>Guías</h2>
            </div>
          </div>
          {/* Cada guía abre en un diálogo. Antes eran links a esta misma
              página: se tocaban y no pasaba nada. */}
          <Guias />
        </section>

        <section className="card">
          <div className="card-h">
            <div>
              <h2>Preguntas frecuentes</h2>
            </div>
          </div>
          <Faq />
        </section>
      </div>
    </main>
  );
}
