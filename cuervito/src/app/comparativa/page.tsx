import Link from "next/link";

import { RevealOnScroll } from "../_components/reveal-on-scroll";

export default function ComparativaPage() {
  return (
    <>
      <RevealOnScroll />

      <nav className="nav">
        <div className="nav-left">
          <Link href="/" className="nav-back">
            <i className="ti ti-arrow-left" style={{ fontSize: 16 }} />
            <span>Volver</span>
          </Link>
          <div className="nav-div"></div>
          <Link href="/" className="logo">
            cuerv<span className="logo-dot"></span>to
          </Link>
        </div>
        <div className="nav-cta">
          <Link href="/signup" className="btn btn-outline">
            Soy fotógrafo
          </Link>
          <Link href="/signup" className="btn btn-primary">
            Sumarme
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <header className="hero">
        <div className="container hero-inner">
          <span className="eyebrow">
            <i className="ti ti-versus" style={{ fontSize: 14 }} />
            Comparativa
          </span>
          <h1>
            Misma comisión.<br />
            <span className="accent">Mejor todo lo demás.</span>
          </h1>
          <p className="lede">
            Somos una plataforma diseñada con criterio profesional, priorizando la experiencia del usuario.
            El fotógrafo vende más porque sus clientes encuentran y compran más rápido — y el atleta
            se lleva una experiencia de compra premium, no un trámite.
          </p>
          <p className="lede" style={{ marginTop: -18 }}>
            Mejor diseño, mejor UX, mejor tasa de conversión. Las fotos se entregan al instante por{" "}
            <strong style={{ color: "var(--text-primary)" }}>email y WhatsApp</strong> — aunque no
            hace falta esperar:{" "}
            <strong style={{ color: "var(--text-primary)" }}>
              se descargan directo apenas se confirma el pago
            </strong>
            .
          </p>
          <div className="cta-row">
            <a href="#tabla" className="btn btn-primary">
              <i className="ti ti-table" />
              Ver comparativa
            </a>
            <Link href="/signup" className="btn btn-outline">
              Cambiar a Cuervito
            </Link>
          </div>

          <div className="try-boxes">
            <span className="try-eyebrow">No nos creas — probá vos</span>

            <Link className="try-box" href="/dashboard/events">
              <div className="ic">
                <i className="ti ti-cloud-upload" />
              </div>
              <span className="tag">Lado fotógrafo</span>
              <div className="ttl">Subida de fotos</div>
              <div className="desc">
                Drag &amp; drop masivo, watermark automático, progreso en vivo y modal con la lista
                de archivos.
              </div>
              <span className="go">
                Probar el flujo
                <i className="ti ti-arrow-right" />
              </span>
            </Link>

            <a className="try-box" href="#eventos">
              <div className="ic">
                <i className="ti ti-shopping-cart-plus" />
              </div>
              <span className="tag">Lado comprador</span>
              <div className="ttl">Compra del lado del usuario</div>
              <div className="desc">
                Búsqueda por dorsal o selfie, carrito con upsell en vivo, descuentos automáticos y
                checkout en 2 pasos.
              </div>
              <span className="go">
                Probar el flujo
                <i className="ti ti-arrow-right" />
              </span>
            </a>

            <a className="try-box" href="#eventos">
              <div className="ic">
                <i className="ti ti-download" />
              </div>
              <span className="tag">Lado comprador</span>
              <div className="ttl">Descarga del lado del usuario</div>
              <div className="desc">
                Confirmación visual, descarga inmediata y flujo guiado paso a paso optimizado para
                iPhone.
              </div>
              <span className="go">
                Probar el flujo
                <i className="ti ti-arrow-right" />
              </span>
            </a>
          </div>
        </div>
      </header>

      {/* COMPARISON TABLE */}
      <section className="compare" id="tabla">
        <div className="container">
          <div className="compare-wrap">
            <div className="compare-head">
              <div>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10.5,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "var(--text-tertiary)",
                  }}
                >
                  Plataforma
                </span>
              </div>
              <div className="cuervito-col">
                <span className="platform-name">Cuervito</span>
                <span className="platform-tag">10% · ilimitado</span>
              </div>
              <div>
                <span className="platform-name">Competidor</span>
                <span className="platform-tag">10–20% comisión</span>
              </div>
            </div>

            {/* Cobros */}
            <Section title="Cobros" icon="ti-cash" />
            <Row label="Comisión por venta">
              <Win>
                <span className="commission-good mono">10%</span>
              </Win>
              <Loss>
                <span className="commission-bad mono">10–20%</span>
              </Loss>
            </Row>
            <Row label="Cuota mensual">
              <Win><Yes>Gratis</Yes></Win>
              <Cell><Yes>Gratis</Yes></Cell>
            </Row>
            <Row label="Acreditación inmediata vía Mercado Pago">
              <Win><Yes>Sí</Yes></Win>
              <Cell><Maybe /></Cell>
            </Row>

            {/* Almacenamiento */}
            <Section title="Almacenamiento y límites" icon="ti-database" />
            <Row label="Almacenamiento">
              <Win><strong>Ilimitado</strong></Win>
              <Cell>100 GB</Cell>
            </Row>
            <Row label="Álbumes / eventos">
              <Win><strong>Sin límite</strong></Win>
              <Cell>Hasta 100</Cell>
            </Row>
            <Row label="Tamaño máximo por foto">
              <Win><strong>50 MB</strong></Win>
              <Cell>30 MB</Cell>
            </Row>
            <Row label="Video por archivo">
              <Cell cuervito><strong>2 GB</strong></Cell>
              <Cell>1 GB</Cell>
            </Row>

            {/* Reconocimiento */}
            <Section title="Reconocimiento" icon="ti-scan-eye" />
            <Row label="Reconocimiento facial automático">
              <Cell cuervito><Yes>Sí</Yes></Cell>
              <Cell><Yes>Sí</Yes></Cell>
            </Row>
            <Row label="Reconocimiento de dorsal (OCR)">
              <Cell cuervito><Yes>Sí</Yes></Cell>
              <Cell><Yes>Sí</Yes></Cell>
            </Row>
            <Row label="Marca de agua automática">
              <Cell cuervito><Yes>Sí</Yes></Cell>
              <Cell><Yes>Sí</Yes></Cell>
            </Row>

            {/* Página y marca */}
            <Section title="Página de venta y marca personal" icon="ti-template" />
            <Row label="Página de venta personalizable">
              <Win><Yes>Sí</Yes></Win>
              <Cell><No>No</No></Cell>
            </Row>
            <Row label="Plantillas editables">
              <Win><Yes>4 plantillas</Yes></Win>
              <Cell><No>No</No></Cell>
            </Row>
            <Row label="Dominio propio">
              <Win><Yes>Sí</Yes></Win>
              <Cell><No>No</No></Cell>
            </Row>
            <Row label="Color de marca personalizable">
              <Win><Yes>Sí</Yes></Win>
              <Cell><No>No</No></Cell>
            </Row>

            {/* Experiencia */}
            <Section title="Experiencia (lo que realmente cambia)" icon="ti-sparkles" />
            <Row label="Interfaz moderna 2026">
              <Win><Yes>Sí</Yes></Win>
              <Cell><No>No</No></Cell>
            </Row>
            <Row label="Animaciones premium">
              <Win><Yes>Sí</Yes></Win>
              <Cell><No>No</No></Cell>
            </Row>
            <Row label="Búsqueda en vivo del evento">
              <Win><Yes>Sí</Yes></Win>
              <Cell><No>No</No></Cell>
            </Row>
            <Row label="Flujo iOS paso a paso para descargar">
              <Win><Yes>Sí</Yes></Win>
              <Cell><No>No</No></Cell>
            </Row>
            <Row label="Carteles de upsell en vivo en el carrito">
              <Win><Yes>Sí</Yes></Win>
              <Cell><No>No</No></Cell>
            </Row>

            {/* Ventas */}
            <Section title="Herramientas de venta" icon="ti-shopping-cart" />
            <Row label="Packs / ventas por paquete">
              <Cell cuervito><Yes>Sí</Yes></Cell>
              <Cell><Yes>Sí</Yes></Cell>
            </Row>
            <Row label="Descuentos por cantidad">
              <Cell cuervito><Yes>Sí</Yes></Cell>
              <Cell><Yes>Sí</Yes></Cell>
            </Row>
            <Row label="Códigos de descuento (% o $ fijo)">
              <Win><Yes>Sí</Yes></Win>
              <Cell><No>No</No></Cell>
            </Row>
            <Row label="Colaboradores (varios fotógrafos)">
              <Cell cuervito><Yes>Sí</Yes></Cell>
              <Cell><Yes>Sí</Yes></Cell>
            </Row>
          </div>
        </div>
      </section>

      {/* Where we really win */}
      <section className="why-win">
        <div className="container">
          <div className="why-head reveal">
            <span className="eyebrow">
              <i className="ti ti-sparkles" style={{ fontSize: 14 }} />
              Dónde realmente ganamos
            </span>
            <h2>Las features son iguales. La experiencia, no.</h2>
            <p>
              Todas las plataformas reconocen caras y dorsales. Lo que cambia es{" "}
              <strong style={{ color: "var(--text-primary)" }}>cómo se siente usarlas</strong> —
              tanto para vos como para tu cliente.
            </p>
          </div>

          <div className="win-grid">
            <article className="win-card reveal">
              <div className="ic">
                <i className="ti ti-template" />
              </div>
              <h3>Tu página, tu marca.</h3>
              <p>
                Mientras otras plataformas te dejan en una galería genérica con su logo, vos tenés
                tu propia página con plantilla editable, color personalizable y dominio propio.
              </p>
              <div className="micro">Único en esta categoría</div>
            </article>

            <article className="win-card reveal">
              <div className="ic">
                <i className="ti ti-wand" />
              </div>
              <h3>Experiencia premium.</h3>
              <p>
                Animaciones, transiciones, búsqueda en vivo, flujo iOS paso a paso, upsells en el
                carrito. La interfaz que tus clientes esperan en 2026 — no la del 2018.
              </p>
              <div className="micro">Diseñado con criterio editorial</div>
            </article>

            <article className="win-card reveal">
              <div className="ic">
                <i className="ti ti-rocket" />
              </div>
              <h3>Onboarding en 60 segundos.</h3>
              <p>
                Conectás Mercado Pago, subís fotos y empezás a vender el mismo día. Sin formularios
                eternos ni revisión manual de 48 horas.
              </p>
              <div className="micro">Otras plataformas: hasta 48 hs · Cuervito: al toque</div>
            </article>
          </div>
        </div>
      </section>

      {/* Pricing impact */}
      <section className="pricing-impact">
        <div className="container pi-inner reveal">
          <span className="eyebrow">
            <i className="ti ti-calculator" style={{ fontSize: 14 }} />
            Impacto real en tu bolsillo
          </span>
          <h2>Si vendés $100.000 por mes…</h2>
          <p className="lede">Esto se queda cada plataforma, y esto te llevás vos.</p>

          <div className="pi-grid">
            <div className="pi-card us">
              <div className="label">Tu mejor opción</div>
              <div className="name">
                Cuervito<span className="pct">· 10%</span>
              </div>
              <div className="breakdown">
                <div className="row">
                  <span className="k">Comisión</span>
                  <span className="v">$10.000</span>
                </div>
                <div className="row">
                  <span className="k">Storage / setup</span>
                  <span className="v">$0</span>
                </div>
              </div>
              <div className="net">
                <span className="k">Te llevás</span>
                <span className="v">$90.000</span>
              </div>
            </div>

            <div className="pi-card bad">
              <div className="label">Otra plataforma</div>
              <div className="name">
                Competidor<span className="pct">· 10–20%</span>
              </div>
              <div className="breakdown">
                <div className="row">
                  <span className="k">Comisión</span>
                  <span className="v">$10.000–$20.000</span>
                </div>
                <div className="row">
                  <span className="k">Storage / setup</span>
                  <span className="v">$0</span>
                </div>
              </div>
              <div className="net">
                <span className="k">Te llevás</span>
                <span className="v">$80.000–$90.000</span>
              </div>
            </div>
          </div>

          <p style={{ marginTop: 30, fontSize: 14, color: "var(--text-tertiary)" }}>
            En el peor caso te llevás{" "}
            <strong style={{ color: "var(--accent)" }}>hasta $10.000 más por mes</strong>, solo por
            elegir bien.
          </p>
        </div>
      </section>

      {/* Final CTA */}
      <section className="final-cta">
        <div className="container">
          <div className="final-card reveal">
            <h2>
              Cambiate a <span className="accent">Cuervito</span> hoy.
            </h2>
            <p>
              Te ayudamos a portar tu evento actual sin perder ni una venta. Tomamos 30 minutos por
              WhatsApp y migrás.
            </p>
            <div className="ctas">
              <Link href="/signup" className="btn btn-primary">
                <i className="ti ti-arrow-right" />
                Empezar gratis
              </Link>
              <a href="https://wa.me/" className="btn btn-outline" target="_blank" rel="noopener">
                <i className="ti ti-brand-whatsapp" />
                Hablamos por WhatsApp
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

/* ───────── Helper components for the compare table ───────── */

function Section({ title, icon }: { title: string; icon: string }) {
  return (
    <div className="compare-row">
      <div className="compare-section">
        <i className={`ti ${icon}`} />
        {title}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="compare-row">
      <div>{label}</div>
      {children}
    </div>
  );
}

function Win({ children }: { children: React.ReactNode }) {
  return <div className="cuervito-col win">{children}</div>;
}

function Cell({ children, cuervito = false }: { children: React.ReactNode; cuervito?: boolean }) {
  return <div className={cuervito ? "cuervito-col" : ""}>{children}</div>;
}

function Loss({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}

function Yes({ children }: { children: React.ReactNode }) {
  return (
    <span className="yes">
      <i className="ti ti-circle-check-filled" />
      <span>{children}</span>
    </span>
  );
}

function No({ children }: { children: React.ReactNode }) {
  return (
    <span className="no">
      <i className="ti ti-x" />
      <span>{children}</span>
    </span>
  );
}

function Maybe() {
  return (
    <span className="no">
      <i className="ti ti-help-circle" />
      <span>—</span>
    </span>
  );
}
