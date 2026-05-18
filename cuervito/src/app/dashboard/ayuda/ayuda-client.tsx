"use client";

import Link from "next/link";
import { useState } from "react";

const FAQ: { q: string; a: string }[] = [
  {
    q: "¿Cuánto cobra Cuervito por venta?",
    a: "10% del total de cada compra. El resto se transfiere a tu cuenta de Mercado Pago automáticamente cuando se acredita el pago.",
  },
  {
    q: "¿Cuándo cobro lo que vendo?",
    a: "El neto entra a tu cuenta de Mercado Pago el mismo momento en que el comprador paga. Después podés retirarlo desde MP según los plazos habituales (instantáneo o en 48 hs según método).",
  },
  {
    q: "¿Mis fotos están protegidas?",
    a: "Sí. Las previsualizaciones públicas tienen una marca de agua y son de baja resolución. La foto original sin marca solo se entrega después del pago, con un link de descarga que vence en 30 días.",
  },
  {
    q: "¿Qué pasa si una foto sale mal subida?",
    a: "Podés borrar o reemplazar fotos desde el dashboard del evento cuando quieras. Si la foto ya tenía ventas, las personas que la compraron pueden seguir descargándola desde su link durante los 30 días posteriores al pago; vos no la ves más en tu galería.",
  },
  {
    q: "¿Cómo funciona la búsqueda por dorsal y selfie?",
    a: "Cuando subís fotos, Cuervito detecta automáticamente los números de dorsal (OCR) e indexa las caras (reconocimiento facial). El comprador puede buscar por dorsal o tomarse una selfie y aparecen sus fotos.",
  },
  {
    q: "¿Puedo cambiar el precio de una foto puntual?",
    a: "Sí, desde el listado de fotos del evento podés sobrescribir el precio de una foto específica. Si no, se usa el precio default del evento.",
  },
  {
    q: "¿Qué pasa si un comprador pide reembolso?",
    a: "Por ahora los reembolsos se manejan directamente con Mercado Pago. Avisanos por soporte y te ayudamos a procesarlo del lado de Cuervito.",
  },
  {
    q: "¿Cuántas fotos puedo subir?",
    a: "El límite default es 100 GB de storage y 10.000 reconocimientos faciales por mes. Si necesitás más, escribinos.",
  },
];

export function AyudaClient() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <main className="wrap-ayuda">
      <div className="head">
        <h1>Ayuda</h1>
        <div className="sub">Guías, FAQ y soporte directo. Respondemos en 12hs hábiles.</div>
      </div>

      <div className="help-list">
        <Link href="#guia" className="help-item">
          <div className="icon">
            <i className="ti ti-book-2" />
          </div>
          <div className="body">
            <div className="title">Guía para empezar</div>
            <div className="desc">Cómo subir tu primer evento, paso a paso</div>
          </div>
          <i className="ti ti-chevron-right chev" />
        </Link>
        <a href="mailto:hola@cuervito.app" className="help-item">
          <div className="icon">
            <i className="ti ti-message-circle" />
          </div>
          <div className="body">
            <div className="title">Soporte directo</div>
            <div className="desc">hola@cuervito.app · respuesta en 12hs hábiles</div>
          </div>
          <i className="ti ti-chevron-right chev" />
        </a>
        <Link href="#faq" className="help-item">
          <div className="icon">
            <i className="ti ti-help" />
          </div>
          <div className="body">
            <div className="title">Preguntas frecuentes</div>
            <div className="desc">Comisiones, cobros, calidad de fotos y más</div>
          </div>
          <i className="ti ti-chevron-right chev" />
        </Link>
      </div>

      <section id="guia" className="ayuda-section">
        <h2>Guía para empezar</h2>
        <ol className="guide-steps">
          <li>
            <strong>Completá tu perfil.</strong> Subí tu foto, definí tu usuario
            público (la URL de tu storefront) y escribí una bio.
          </li>
          <li>
            <strong>Conectá Mercado Pago.</strong> Sin MP conectado no podés
            recibir ventas. Andá a <Link href="/dashboard/cobros">Cobros</Link>.
          </li>
          <li>
            <strong>Creá un evento.</strong> Definí nombre, fecha, ubicación y
            precio por foto.
          </li>
          <li>
            <strong>Subí las fotos.</strong> Pueden ser hasta 30 MB c/u.
            Cuervito genera previews con marca de agua, detecta dorsales con OCR
            e indexa caras para búsqueda por selfie.
          </li>
          <li>
            <strong>Publicá el evento.</strong> Cuando esté listo, marcá el
            evento como publicado y compartí el link de tu storefront.
          </li>
        </ol>
      </section>

      <section id="faq" className="ayuda-section">
        <h2>Preguntas frecuentes</h2>
        <div className="faq-list">
          {FAQ.map((f, i) => {
            const open = openIdx === i;
            return (
              <button
                key={i}
                type="button"
                className={`faq-item ${open ? "open" : ""}`}
                onClick={() => setOpenIdx(open ? null : i)}
              >
                <div className="faq-q">
                  <span>{f.q}</span>
                  <i className={`ti ${open ? "ti-minus" : "ti-plus"} chev`} />
                </div>
                {open && <div className="faq-a">{f.a}</div>}
              </button>
            );
          })}
        </div>
      </section>
    </main>
  );
}
