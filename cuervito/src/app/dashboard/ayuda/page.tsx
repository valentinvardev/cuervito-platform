import Link from "next/link";
import { ArrowRight, LifeBuoy, ScanFace, Upload, Wallet } from "lucide-react";

import { whatsappUrl } from "~/lib/support";

import { sesionPanel } from "../_components/sesion";
import { Faq } from "./_faq";

export const dynamic = "force-dynamic";

const GUIAS = [
  {
    icono: Upload,
    titulo: "Subir un evento",
    texto: "De crear el evento a publicarlo, con los tamaños y formatos que conviene usar.",
  },
  {
    icono: ScanFace,
    titulo: "Cómo funciona el reconocimiento",
    texto: "Qué detectamos, por qué a veces falla y cómo mejorar los resultados.",
  },
  {
    icono: Wallet,
    titulo: "Métodos de pago",
    texto: "Cómo conectás tu cuenta, cuándo entra la plata y qué comisión se descuenta.",
  },
];

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
            {/* Glifo real de WhatsApp: Lucide no trae logos de marcas, y un
                globo de chat genérico no dice "es WhatsApp", que es justamente
                lo que tranquiliza acá. */}
            <svg className="wa" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.65-2.05-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.01-1.04 2.47s1.06 2.87 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35Z" />
              <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.86 9.86 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.5 2 12.04 2Zm0 18.15h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.25-8.23a8.19 8.19 0 0 1 8.24 8.24c0 4.54-3.7 8.23-8.24 8.23Z" />
            </svg>
            Abrir WhatsApp
          </a>
        </section>

        <section>
          <div className="card-h">
            <div>
              <h2>Guías</h2>
            </div>
          </div>
          <div className="guias">
            {GUIAS.map((g) => (
              <Link href="/dashboard/ayuda" className="gu" key={g.titulo}>
                <span className="gu-i">
                  <g.icono />
                </span>
                <b>{g.titulo}</b>
                <p>{g.texto}</p>
                <span className="mas">
                  Leer <ArrowRight />
                </span>
              </Link>
            ))}
          </div>
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
