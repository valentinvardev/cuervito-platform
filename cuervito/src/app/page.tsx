import "~/styles/prototype/styles.css";
import "~/styles/prototype/panel-anim.css";
import "~/styles/prototype/landing.css";

import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";

import { whatsappUrl } from "~/lib/support";
import { auth } from "~/server/auth";
import { db } from "~/server/db";

import { AthleteSearchBar } from "./_components/athlete-search-bar";
import { DemoEventCta } from "./_components/demo-event-cta";
import { ExternalStylesheets } from "./_components/external-stylesheets";
import { LandingFaq } from "./_components/landing-faq";
import { LandingMobileNav } from "./_components/landing-mobile-nav";
import { LandingTestimonials } from "./_components/landing-testimonials";
import { PhotoStrip, PhotoStripSkeleton } from "./_components/photo-strip";
import { RevealOnScroll } from "./_components/reveal-on-scroll";
import { ThemeToggle } from "./_components/theme-toggle";

/**
 * Los números del catálogo salen de la base, no de una constante. Debajo de
 * estos umbrales no mostramos nada: un contador honesto pero chico convence
 * menos que no poner contador, y uno inventado se desmiente scrolleando
 * hasta la grilla de eventos.
 */
const MIN_EVENTS = 8;
const MIN_PHOTOS = 500;

async function getCatalogStats() {
  const [events, photos] = await Promise.all([
    db.event.count({ where: { isPublished: true, NOT: { status: "ARCHIVED" } } }),
    db.photo.count({ where: { fileSize: { not: null }, deletedAt: null } }),
  ]);
  return {
    events,
    photos,
    show: events >= MIN_EVENTS && photos >= MIN_PHOTOS,
  };
}

export default async function Home() {
  const session = await auth().catch(() => null);
  const stats = await getCatalogStats().catch(() => ({
    events: 0,
    photos: 0,
    show: false,
  }));

  return (
    <div className="lp">
      <RevealOnScroll />
      <ExternalStylesheets />

      {/* CARRIL DEL ATLETA — arriba de todo, sin scroll */}
      <AthleteSearchBar />

      {/* NAV */}
      <nav className="nav hero-anim" style={{ ["--hero-delay" as string]: "0ms" }}>
        <div className="container nav-inner">
          <Link href="/" className="logo">
            cuerv<span className="logo-dot"></span>to
          </Link>
          <div className="nav-links">
            <a href="#como-funciona">Cómo funciona</a>
            <a href="#precio">Precio</a>
            <a href="#preguntas">Preguntas</a>
            <Link href="/comparativa">Comparativa</Link>
          </div>
          <div className="nav-cta">
            <ThemeToggle />
            {session?.user ? (
              <Link href="/dashboard" className="btn btn-primary">
                <i className="ti ti-layout-dashboard"></i> Ir al panel
              </Link>
            ) : (
              <>
                <Link href="/login" className="btn btn-outline">
                  Iniciar sesión
                </Link>
                <Link href="/signup" className="btn btn-primary">
                  Crear cuenta gratis
                </Link>
              </>
            )}
            <LandingMobileNav loggedIn={!!session?.user} />
          </div>
        </div>
      </nav>

      {/* HERO — tesis única: el fotógrafo */}
      <header className="hero-v2">
        <div className="hero-v2-bg"></div>
        <div className="container hero-v2-grid">
          <div className="hero-v2-text">
            <span
              className="eyebrow hero-anim"
              style={{ ["--hero-delay" as string]: "180ms" }}
            >
              <i className="ti ti-camera" style={{ fontSize: 14 }}></i>
              Para fotógrafos de eventos deportivos
            </span>
            <h1
              className="hero-v2-headline compact hero-anim"
              style={{ ["--hero-delay" as string]: "280ms" }}
            >
              Vendé las fotos de la carrera.<br />
              <span className="accent">Cobrás en tu Mercado Pago.</span>
            </h1>
            <p
              className="hero-v2-sub hero-anim"
              style={{ ["--hero-delay" as string]: "420ms" }}
            >
              Subís las fotos y listo: reconocemos cara y dorsal, armamos tu
              página de venta con tu marca, y cada compra entra directo a tu
              cuenta, menos el 10%. Nosotros nunca tocamos tu plata.
            </p>
            <div
              className="hero-v2-cta hero-anim"
              style={{ ["--hero-delay" as string]: "540ms" }}
            >
              <Link href="/signup" className="btn btn-primary btn-lg">
                <i className="ti ti-arrow-right"></i>Crear mi cuenta gratis
              </Link>
              <a href="#demo" className="btn btn-outline btn-lg">
                <i className="ti ti-hand-click"></i>Ver un evento real
              </a>
            </div>
            <div
              className="hero-v2-trust hero-anim"
              style={{ ["--hero-delay" as string]: "660ms" }}
            >
              <span>Sin cuota mensual</span>
              <span className="sep"></span>
              <span>Sin tarjeta</span>
              <span className="sep"></span>
              <span>
                <strong>10%</strong> sólo si vendés
              </span>
              <span className="sep"></span>
              <span>
                <i
                  className="ti ti-brand-whatsapp"
                  style={{ fontSize: 14, color: "#25D366", verticalAlign: -2, marginRight: 4 }}
                ></i>
                Soporte <strong>24 hs</strong></span>
            </div>
          </div>

          <div
            className="hero-v2-illustration hero-anim from-right"
            aria-hidden="true"
            style={{ ["--hero-delay" as string]: "380ms" }}
          >
            <Image
              src="/assets/illustrations/hero.png"
              alt=""
              width={950}
              height={839}
              priority
              sizes="(max-width: 960px) 90vw, 640px"
            />
          </div>
        </div>
      </header>

      {/* TIRA DE FOTOS — prueba visual, ahora con epígrafe */}
      <Suspense fallback={<PhotoStripSkeleton />}>
        <PhotoStrip />
      </Suspense>
      {stats.show && (
        <p className="strip-caption">
          Fotos de eventos publicados en Cuervito ·{" "}
          <strong>{stats.events.toLocaleString("es-AR")}</strong> eventos ·{" "}
          <strong>{stats.photos.toLocaleString("es-AR")}</strong> fotos
        </p>
      )}

      {/* CÓMO FUNCIONA — del lado del fotógrafo */}
      <section className="how-v2" id="como-funciona">
        <div className="container how-grid">
          <div className="how-text reveal">
            <span className="eyebrow">
              <i className="ti ti-route" style={{ fontSize: 14 }}></i>Cómo
              funciona
            </span>
            <h2 className="h-section">De la tarjeta de memoria a tu cuenta.</h2>
            <p className="lede">
              Vos cubrís el evento. Indexar, publicar, cobrar y entregar lo
              hace la plataforma.
            </p>
            <ol className="how-steps">
              <li className="how-step">
                <div className="num">01</div>
                <div>
                  <h3>Subís las fotos del evento</h3>
                  <p>
                    Drag &amp; drop masivo. La marca de agua va sólo en las
                    previews: el original queda intacto para el que compra.
                  </p>
                </div>
              </li>
              <li className="how-step">
                <div className="num">02</div>
                <div>
                  <h3>Indexamos y armamos tu página</h3>
                  <p>
                    Reconocimiento de cara y de dorsal en cada foto, y tu
                    galería publicada con tu plantilla, tu color y tu dominio.
                  </p>
                </div>
              </li>
              <li className="how-step">
                <div className="num">03</div>
                <div>
                  <h3>El atleta compra y vos cobrás</h3>
                  <p>
                    Encuentra las suyas en segundos y paga sin crear cuenta. La
                    plata entra a tu Mercado Pago en el momento, con el 10% ya
                    descontado.
                  </p>
                </div>
              </li>
            </ol>
          </div>

          <div
            className="face-scan reveal"
            style={{ ["--reveal-delay" as string]: "120ms" }}
            aria-hidden="true"
          >
            <span className="face-id-badge">
              <i className="ti ti-scan-eye"></i>FACE ID · 99%
            </span>

            <div className="face-scene">
              <svg className="face-svg" viewBox="0 0 200 240" xmlns="http://www.w3.org/2000/svg">
                <path
                  className="outline"
                  fill="none"
                  stroke="#F5820A"
                  strokeWidth="2.2"
                  opacity="0.95"
                  d="M100 24 C148 24 168 64 168 124 C168 178 138 218 100 218 C62 218 32 178 32 124 C32 64 52 24 100 24 Z"
                />
                <g
                  className="lines"
                  stroke="#F5820A"
                  strokeWidth="0.7"
                  opacity="0.18"
                  fill="none"
                  strokeDasharray="2 3"
                >
                  <line x1="100" y1="60" x2="100" y2="200" />
                  <line x1="40" y1="106" x2="160" y2="106" />
                  <line x1="60" y1="172" x2="140" y2="172" />
                </g>
                <g className="hat">
                  <path
                    fill="#F5820A"
                    d="M30 42 Q100 68 170 42 L172 50 Q100 72 28 50 Z"
                  />
                  <path
                    fill="#F5820A"
                    stroke="#0F0D0B"
                    strokeWidth="1"
                    strokeOpacity="0.25"
                    d="M52 44 C52 12 74 -4 100 -4 C126 -4 148 12 148 44 Z"
                  />
                </g>
                <ellipse className="eye" cx="78" cy="106" rx="6.5" ry="3.5" fill="#F5820A" />
                <ellipse className="eye" cx="122" cy="106" rx="6.5" ry="3.5" fill="#F5820A" />
                <path
                  className="nose"
                  d="M100 126 L94 152 L106 152"
                  fill="none"
                  stroke="#F5820A"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path
                  className="mouth-smile"
                  d="M84 172 Q100 186 116 172"
                  fill="none"
                  stroke="#F5820A"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                />
                <ellipse
                  className="mouth-o"
                  cx="100"
                  cy="180"
                  rx="5.5"
                  ry="7.5"
                  fill="none"
                  stroke="#4CAF7D"
                  strokeWidth="2.4"
                />
              </svg>
            </div>

            <div className="scan-corner tl"></div>
            <div className="scan-corner tr"></div>
            <div className="scan-corner bl"></div>
            <div className="scan-corner br"></div>

            <div className="scan-line-y"></div>

            <div className="face-status">
              <div className="status-row status-scanning">
                <span className="scan-spin"></span>
                <span>Reconociendo rostro</span>
              </div>
              <div className="status-row status-found">
                <i className="ti ti-circle-check-filled"></i>
                <span>Rostro encontrado</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TRES RAZONES — plata, marca, conversión */}
      <section className="photog-v2">
        <div className="container photog-v2-grid">
          <div className="photog-v2-text reveal">
            <span className="eyebrow">
              <i className="ti ti-coin" style={{ fontSize: 14 }}></i>Por qué
              Cuervito
            </span>
            <h2 className="h-section">Tus fotos, tu página, tu plata.</h2>

            <ul className="value-list">
              <li>
                <i className="ti ti-building-bank"></i>
                <div>
                  <strong>Cobrás vos, no nosotros.</strong>
                  <p>
                    La compra entra a tu cuenta de Mercado Pago en el momento,
                    con el 10% ya descontado. Sin retiros, sin mínimos y sin
                    esperar treinta días.
                  </p>
                </div>
              </li>
              <li>
                <i className="ti ti-template"></i>
                <div>
                  <strong>Tu marca, tu dominio.</strong>
                  <p>
                    Cuatro plantillas editables, tu color, tu logo y tu dominio
                    propio. El atleta te compra a vos, no a una galería con el
                    logo de otro arriba.
                  </p>
                </div>
              </li>
              <li>
                <i className="ti ti-bolt"></i>
                <div>
                  <strong>El atleta encuentra sus fotos en 30 segundos.</strong>
                  <p>
                    Busca por dorsal o sube una selfie, compra sin crear cuenta
                    y descarga al acreditarse el pago. Menos fricción, más fotos
                    vendidas por evento.
                  </p>
                </div>
              </li>
            </ul>

            <div className="paid-with">
              Cobrado con{" "}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/assets/mp/mp-pluma-horizontal.svg" alt="Mercado Pago" />
            </div>

            <Link href="/signup" className="btn btn-primary btn-lg">
              <i className="ti ti-arrow-right"></i>Crear mi cuenta gratis
            </Link>
          </div>

          <div
            className="earn-card reveal"
            style={{ ["--reveal-delay" as string]: "140ms" }}
            aria-hidden="true"
          >
            <div className="earn-head">
              <span className="label">Ventas · hoy</span>
              {/* Mock de producto, no datos reales: se rotula como tal. */}
              <span className="earn-tag">Ejemplo</span>
            </div>
            <div className="earn-amount">
              <span className="currency">$</span>
              <span className="big">48.200</span>
            </div>
            <div className="earn-delta">
              <i className="ti ti-trending-up" style={{ fontSize: 14 }}></i>+18%
              vs ayer
            </div>

            <div className="earn-spark">
              <svg viewBox="0 0 320 36" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="earn-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F5820A" stopOpacity="0.32" />
                    <stop offset="100%" stopColor="#F5820A" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  className="area"
                  d="M0 24 L24 22 L48 26 L72 18 L96 20 L120 14 L144 18 L168 10 L192 14 L216 8 L240 12 L264 6 L288 10 L312 4 L320 6 L320 36 L0 36 Z"
                />
                <path
                  className="line"
                  d="M0 24 L24 22 L48 26 L72 18 L96 20 L120 14 L144 18 L168 10 L192 14 L216 8 L240 12 L264 6 L288 10 L312 4 L320 6"
                />
              </svg>
            </div>

            <div className="earn-stream">
              {[
                { ttl: "Maratón BA · 4 fotos", sub: "dorsal #4218 · ahora", amt: "+$9.600" },
                { ttl: "Trail Patagonia · pack", sub: "dorsal #1842 · hace 2 min", amt: "+$12.600" },
                { ttl: "Gran Fondo Andes", sub: "dorsal #3201 · hace 8 min", amt: "+$5.400" },
                { ttl: "10K Nocturna · 3 fotos", sub: "dorsal #892 · hace 14 min", amt: "+$7.200" },
              ].map((tx) => (
                <div key={tx.ttl} className="earn-tx">
                  <span className="ic">
                    <i className="ti ti-photo"></i>
                  </span>
                  <div className="info">
                    <div className="ttl">{tx.ttl}</div>
                    <div className="sub">{tx.sub}</div>
                  </div>
                  <span className="amt">{tx.amt}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* DEMO — el flujo del comprador, en un evento real.
          Sin <Suspense>: el boundary abría un hueco vacío entre este bloque
          y precio, y el contenido llegaba al final del stream. Es una sola
          query indexada y la página ya es dinámica, así que se espera. */}
      <DemoEventCta />

      {/* PRECIO */}
      <section className="pricing" id="precio">
        <div className="container">
          <div className="pricing-head reveal">
            <span className="eyebrow">
              <i className="ti ti-receipt" style={{ fontSize: 14 }}></i>Precio
            </span>
            <h2 className="h-section">
              Gratis. Te cobramos sólo cuando cobrás vos.
            </h2>
          </div>

          <div className="price-card reveal">
            <div className="price-figures">
              <div className="price-block">
                <span className="pf-value">
                  <span className="cur">$</span>0
                </span>
                <span className="pf-label">por mes</span>
                <span className="pf-note">Sin alta, sin tarjeta, sin permanencia.</span>
              </div>
              <div className="price-div" aria-hidden="true"></div>
              <div className="price-block">
                <span className="pf-value">10%</span>
                <span className="pf-label">por venta</span>
                <span className="pf-note">
                  Se descuenta en la misma operación de Mercado Pago.
                </span>
              </div>
            </div>

            <div className="price-includes">
              <span className="pi-title">Todo incluido</span>
              <ul>
                <li>
                  <i className="ti ti-check"></i>100 GB de almacenamiento
                </li>
                <li>
                  <i className="ti ti-check"></i>Eventos y fotos ilimitados
                </li>
                <li>
                  <i className="ti ti-check"></i>Reconocimiento de cara y dorsal
                </li>
                <li>
                  <i className="ti ti-check"></i>Marca de agua automática
                </li>
                <li>
                  <i className="ti ti-check"></i>Tu página con dominio propio
                </li>
                <li>
                  <i className="ti ti-check"></i>Códigos de descuento
                </li>
                <li>
                  <i className="ti ti-check"></i>Descuentos por cantidad
                </li>
                <li>
                  <i className="ti ti-check"></i>Colaboradores con comisión propia
                </li>
                <li>
                  <i className="ti ti-check"></i>Entrega y descarga automáticas
                </li>
                <li>
                  <i className="ti ti-check"></i>Soporte por WhatsApp las 24 horas
                </li>
              </ul>
              <p className="price-foot">
                Si un mes no vendés, pagás <strong>$0</strong>.
              </p>
              <Link href="/signup" className="btn btn-primary btn-lg">
                <i className="ti ti-arrow-right"></i>Empezar gratis
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* PRUEBA SOCIAL — se renderiza cuando haya testimonios reales */}
      <LandingTestimonials />

      {/* PREGUNTAS */}
      <LandingFaq />

      {/* COMPARATIVA */}
      <section className="compare-cta">
        <div className="container">
          <div className="compare-card reveal">
            <span className="compare-eyebrow">
              <i className="ti ti-versus" style={{ fontSize: 14 }}></i>Cuervito
              vs el resto
            </span>
            <h2>¿Ya vendés en otra plataforma?</h2>
            <p>
              Misma comisión. Pero cobrás en el acto, en tu cuenta, y con tu
              marca adelante.
            </p>
            <Link href="/comparativa" className="btn-on-accent">
              Ver la tabla completa<i className="ti ti-arrow-right"></i>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="final-strip">
        <div className="container">
          <div className="cta-strip reveal">
            <div className="cta-strip-inner">
              <h2 className="h-section">Publicá tu primer evento hoy.</h2>
              <p>
                Creás la cuenta, conectás Mercado Pago y subís las fotos. El
                mismo día podés estar vendiendo. Si te trabás, te contestamos
                por WhatsApp a cualquier hora.
              </p>
              <div className="btn-row">
                <Link href="/signup" className="btn btn-primary btn-lg">
                  <i className="ti ti-arrow-right"></i>Crear mi cuenta gratis
                </Link>
                <a
                  href={whatsappUrl(
                    "Hola, quiero empezar a vender mis fotos con Cuervito.",
                  )}
                  className="btn btn-outline btn-lg"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <i className="ti ti-brand-whatsapp"></i>Hablar por WhatsApp
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="footer reveal">
        <div className="container">
          <div className="footer-grid">
            <div className="footer-brand">
              <Link href="/" className="logo">
                cuerv<span className="logo-dot"></span>to
              </Link>
              <p>
                La plataforma para vender fotos de eventos deportivos en
                Argentina. Tu marca adelante, tu plata en tu cuenta.
              </p>
            </div>
            <div>
              <h5>Fotógrafos</h5>
              <ul>
                <li>
                  <Link href="/signup">Crear cuenta gratis</Link>
                </li>
                <li>
                  <Link href="/login">Iniciar sesión</Link>
                </li>
                <li>
                  <Link href="/comparativa">Comparativa</Link>
                </li>
                <li>
                  <a href="#precio">Precio</a>
                </li>
                <li>
                  <a
                    href={whatsappUrl("Hola, tengo una consulta sobre Cuervito.")}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Soporte 24 hs por WhatsApp
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h5>Atletas</h5>
              <ul>
                <li>
                  <Link href="/eventos">Buscar mis fotos</Link>
                </li>
                <li>
                  <a href="#como-funciona">Cómo funciona</a>
                </li>
                <li>
                  <a href="#preguntas">Preguntas frecuentes</a>
                </li>
              </ul>
            </div>
            <div>
              <h5>Legal</h5>
              <ul>
                <li>
                  <Link href="/terminos">Términos</Link>
                </li>
                <li>
                  <Link href="/privacidad">Privacidad</Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
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
