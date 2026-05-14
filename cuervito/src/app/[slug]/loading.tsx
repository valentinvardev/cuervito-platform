/**
 * Mirrors the real /[slug] layout 1:1 so there's no shift when the real
 * server component swaps in. Uses the same class structure (.hero, .hero-inner,
 * .photog-row, .photog-avatar, .photog-info, .photog-name, .photog-meta) and
 * the same grid spec as page.tsx — only the text/avatar nodes become skel pills.
 */
export default function Loading() {
  return (
    <>
      <nav className="nav">
        <div className="nav-left">
          <span className="logo" aria-hidden="true">
            cuerv<span className="logo-dot"></span>to
          </span>
        </div>
      </nav>

      <header className="hero">
        <div className="hero-cover" aria-hidden="true" />
        <div className="hero-inner">
          <div className="photog-row">
            <div
              className="photog-avatar"
              style={{
                background:
                  "linear-gradient(90deg, rgba(255,255,255,0.08), rgba(255,255,255,0.18), rgba(255,255,255,0.08))",
                backgroundSize: "200% 100%",
                animation: "skel-shimmer 1.2s ease-in-out infinite",
                color: "transparent",
              }}
            />
            <div className="photog-info">
              <h1 className="photog-name">
                <span
                  className="skel"
                  style={{
                    width: 220,
                    height: 26,
                    display: "inline-block",
                    background: "rgba(255,255,255,0.16)",
                  }}
                />
              </h1>
              <div className="photog-meta">
                <span
                  className="skel"
                  style={{
                    width: 280,
                    height: 13,
                    display: "inline-block",
                    background: "rgba(255,255,255,0.12)",
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="main">
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 22,
            letterSpacing: "-0.02em",
            marginBottom: 14,
          }}
        >
          Eventos
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 14,
          }}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="skel"
              style={{
                aspectRatio: "16/10",
                borderRadius: 14,
                opacity: 0.7,
              }}
            />
          ))}
        </div>
      </main>
    </>
  );
}
