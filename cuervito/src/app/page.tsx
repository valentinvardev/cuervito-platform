import "~/styles/prototype/styles.css";
import "~/styles/prototype/panel-anim.css";
import "~/styles/prototype/landing.css";

import Link from "next/link";

import { auth } from "~/server/auth";

import { LandingMobileNav } from "./_components/landing-mobile-nav";
import { LiveEventsSearch } from "./_components/live-events-search";
import { RevealOnScroll } from "./_components/reveal-on-scroll";

export default async function Home() {
  const session = await auth().catch(() => null);

  return (
    <div className="lp">
      <RevealOnScroll />

      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@700;800&family=DM+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap"
      />
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.5.0/dist/tabler-icons.min.css"
      />

      {/* NAV */}
      <nav className="nav hero-anim" style={{ ["--hero-delay" as string]: "0ms" }}>
        <div className="container nav-inner">
          <Link href="/" className="logo">
            cuerv<span className="logo-dot"></span>to
          </Link>
          <div className="nav-links">
            <a href="#eventos">Eventos</a>
            <Link href="/signup">Fotógrafos</Link>
            <a href="#como-funciona">Cómo funciona</a>
          </div>
          <div className="nav-cta">
            {session?.user ? (
              <Link href="/dashboard" className="btn btn-primary">
                <i className="ti ti-layout-dashboard"></i> Ir al panel
              </Link>
            ) : (
              <>
                <Link href="/signup" className="btn btn-outline">
                  Soy fotógrafo
                </Link>
                <a href="#eventos" className="btn btn-primary">
                  <i className="ti ti-search"></i> Buscar mis fotos
                </a>
              </>
            )}
            <LandingMobileNav loggedIn={!!session?.user} />
          </div>
        </div>
      </nav>

      {/* HERO */}
      <header className="hero-v2">
        <div className="hero-v2-bg"></div>
        <div className="container hero-v2-grid">
          <div className="hero-v2-text">
            <span
              className="eyebrow hero-anim"
              style={{ ["--hero-delay" as string]: "180ms" }}
            >
              <i className="ti ti-bird" style={{ fontSize: 14 }}></i>
              Reconocimiento visual
            </span>
            <h1
              className="hero-v2-headline hero-anim"
              style={{ ["--hero-delay" as string]: "280ms" }}
            >
              Cuervito encuentra<br />
              <span className="accent">tus fotos.</span>
            </h1>
            <p
              className="hero-v2-sub hero-anim"
              style={{ ["--hero-delay" as string]: "420ms" }}
            >
              Reconocemos personas a través de su foto o número de competición en segundos.
            </p>
            <div
              className="hero-v2-cta hero-anim"
              style={{ ["--hero-delay" as string]: "540ms" }}
            >
              <a href="#eventos" className="btn btn-primary btn-lg">
                <i className="ti ti-search"></i>Buscar mis fotos
              </a>
              <Link href="/signup" className="btn btn-outline btn-lg">
                <i className="ti ti-camera"></i>Soy fotógrafo
              </Link>
            </div>
            <div
              className="hero-v2-trust hero-anim"
              style={{ ["--hero-delay" as string]: "660ms" }}
            >
              <span>
                <strong>2.400+</strong> eventos
              </span>
              <span className="sep"></span>
              <span>
                <strong>180K+</strong> fotos
              </span>
              <span className="sep"></span>
              <span>
                <i
                  className="ti ti-shield-check"
                  style={{ fontSize: 13, color: "var(--success)", verticalAlign: -1, marginRight: 4 }}
                ></i>
                Pago seguro
              </span>
            </div>
          </div>

          <div
            className="hero-v2-illustration hero-anim from-right"
            aria-hidden="true"
            style={{ ["--hero-delay" as string]: "380ms" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/illustrations/hero.png" alt="" />
          </div>
        </div>
      </header>

      {/* HOW IT WORKS */}
      <section className="how-v2" id="como-funciona">
        <div className="container how-grid">
          <div className="how-text reveal">
            <span className="eyebrow">
              <i className="ti ti-scan-eye" style={{ fontSize: 14 }}></i>Cómo funciona
            </span>
            <h2 className="h-section">Reconocimiento automático.</h2>
            <p className="lede">
              Los fotógrafos suben sus fotos del evento, nuestro motor las indexa por{" "}
              <strong style={{ color: "var(--text-primary)" }}>cara y número de dorsal</strong>, y
              cada persona encuentra las suyas en segundos.
            </p>
            <ol className="how-steps">
              <li className="how-step">
                <div className="num">01</div>
                <div>
                  <h3>El fotógrafo sube las fotos</h3>
                  <p>Subida masiva con drag &amp; drop. Watermark automático para preview.</p>
                </div>
              </li>
              <li className="how-step">
                <div className="num">02</div>
                <div>
                  <h3>El motor reconoce caras y dorsales</h3>
                  <p>Cada foto queda indexada por cara, número y momento del evento.</p>
                </div>
              </li>
              <li className="how-step">
                <div className="num">03</div>
                <div>
                  <h3>Cada persona encuentra las suyas</h3>
                  <p>Por selfie o por dorsal. Compra, descarga, listo.</p>
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

      {/* FOR PHOTOGRAPHERS */}
      <section className="photog-v2">
        <div className="container photog-v2-grid">
          <div className="photog-v2-text reveal">
            <span className="eyebrow">
              <i className="ti ti-camera" style={{ fontSize: 14 }}></i>Para fotógrafos
            </span>
            <h2 className="h-section">Tus fotos, tu plata.</h2>
            <p className="lede">
              Subís las fotos, nosotros nos ocupamos del resto: reconocimiento, página de venta,
              cobranza y soporte.
            </p>
            <ul>
              <li>
                <i className="ti ti-cloud-upload"></i>Subida masiva con detección automática
              </li>
              <li>
                <i className="ti ti-coin"></i>Recibís el <strong>90%</strong> de cada venta
              </li>
              <li>
                <i className="ti ti-template"></i>Tu página de venta con plantillas editables
              </li>
              <li>
                <i className="ti ti-shield-check"></i>
                <span className="paid-with">
                  Cobrado con{" "}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/assets/mp/mp-pluma-horizontal.svg" alt="Mercado Pago" />
                </span>
              </li>
            </ul>
            <Link href="/signup" className="btn btn-primary btn-lg">
              <i className="ti ti-arrow-right"></i>Sumarme como fotógrafo
            </Link>
          </div>

          <div
            className="earn-card reveal"
            style={{ ["--reveal-delay" as string]: "140ms" }}
            aria-hidden="true"
          >
            <div className="earn-head">
              <span className="label">Ventas · hoy</span>
              <span className="earn-live">
                <span className="dot"></span>En vivo
              </span>
            </div>
            <div className="earn-amount">
              <span className="currency">$</span>
              <span className="big">48.200</span>
            </div>
            <div className="earn-delta">
              <i className="ti ti-trending-up" style={{ fontSize: 14 }}></i>+18% vs ayer
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

      {/* COMPARE CTA */}
      <section className="compare-cta">
        <div className="container">
          <div className="compare-card reveal">
            <span className="compare-eyebrow">
              <i className="ti ti-versus" style={{ fontSize: 14 }}></i>Cuervito vs el resto
            </span>
            <h2>¿Usás otra plataforma?</h2>
            <p>Hay muchas razones por las que deberías usar la nuestra.</p>
            <Link href="/comparativa" className="btn-on-accent">
              Ver comparativa<i className="ti ti-arrow-right"></i>
            </Link>
          </div>
        </div>
      </section>

      {/* LIVE EVENTS SEARCH */}
      <section className="live-events" id="eventos">
        <div className="container">
          <div className="le-head reveal">
            <span className="eyebrow">
              <i className="ti ti-calendar-event" style={{ fontSize: 14 }}></i>Eventos
            </span>
            <h2 className="h-section">Buscá tu evento.</h2>
            <p>Filtrá en vivo a medida que escribís.</p>
          </div>
          <LiveEventsSearch />
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
                Encontrá tus fotos del evento. Buscá por dorsal, por selfie, o explorá galerías. Tan
                simple como eso.
              </p>
            </div>
            <div>
              <h5>Plataforma</h5>
              <ul>
                <li>
                  <a href="#eventos">Buscar eventos</a>
                </li>
                <li>
                  <a href="#como-funciona">Reconocimiento facial</a>
                </li>
              </ul>
            </div>
            <div>
              <h5>Fotógrafos</h5>
              <ul>
                <li>
                  <Link href="/signup">Sumarte</Link>
                </li>
                <li>
                  <Link href="/login">Iniciar sesión</Link>
                </li>
              </ul>
            </div>
            <div>
              <h5>Legal</h5>
              <ul>
                <li>
                  <a href="#">Términos</a>
                </li>
                <li>
                  <a href="#">Privacidad</a>
                </li>
                <li>
                  <a href="#">Contacto</a>
                </li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <span>© 2026 cuervito.app · Hecho en Argentina</span>
            <div
              className="footer-social"
              style={{ display: "flex", gap: 18, alignItems: "center" }}
            >
              <Link
                href="/terminos"
                style={{ fontSize: 12.5, color: "var(--text-tertiary)" }}
              >
                Términos
              </Link>
              <Link
                href="/privacidad"
                style={{ fontSize: 12.5, color: "var(--text-tertiary)" }}
              >
                Privacidad
              </Link>
              <a href="#" aria-label="Instagram">
                <i className="ti ti-brand-instagram"></i>
              </a>
              <a href="#" aria-label="WhatsApp">
                <i className="ti ti-brand-whatsapp"></i>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
