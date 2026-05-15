/**
 * Mirrors /[slug]/[eventSlug] (event coverage) — uses the real class
 * structure so when the server component lands the skeleton swap is
 * pixel-stable, no layout shift.
 */
export default function Loading() {
  return (
    <>
      <nav className="nav">
        <div className="nav-left">
          <span
            className="skel"
            style={{ width: 32, height: 32, borderRadius: 8 }}
          />
          <div className="nav-divider" />
          <span className="logo" aria-hidden="true">
            cuerv<span className="logo-dot"></span>to
          </span>
        </div>
      </nav>

      <header className="hero has-cover">
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
                    width: 180,
                    height: 24,
                    display: "inline-block",
                    background: "rgba(255,255,255,0.16)",
                  }}
                />
              </h1>
              <div className="photog-meta">
                <span
                  className="skel"
                  style={{
                    width: 240,
                    height: 13,
                    display: "inline-block",
                    background: "rgba(255,255,255,0.12)",
                  }}
                />
              </div>
            </div>
          </div>

          <div className="event-strip">
            <div>
              <div className="lbl">Cobertura de</div>
              <div className="nm">
                <span
                  className="skel"
                  style={{
                    width: 180,
                    height: 16,
                    display: "inline-block",
                    background: "rgba(255,255,255,0.18)",
                  }}
                />
              </div>
            </div>
            <div className="meta" style={{ marginLeft: 14 }}>
              <span
                className="skel"
                style={{
                  width: 200,
                  height: 13,
                  display: "inline-block",
                  background: "rgba(255,255,255,0.14)",
                }}
              />
            </div>
          </div>

          {/* Search card lives inside the hero (in-hero variant) */}
          <div className="search-card in-hero">
            <div className="input-with-icon">
              <i className="ti ti-search" />
              <span
                className="skel"
                style={{
                  width: "100%",
                  height: 18,
                  display: "block",
                  borderRadius: 4,
                }}
              />
            </div>
            <span
              className="skel"
              style={{
                width: 140,
                height: 36,
                borderRadius: 8,
              }}
            />
            <span
              className="skel"
              style={{
                width: 100,
                height: 36,
                borderRadius: 8,
              }}
            />
          </div>
        </div>
      </header>

      <main className="main">
        <div className="photo-grid">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="skel"
              style={{
                aspectRatio: "3/2",
                borderRadius: 8,
                opacity: 0.7,
              }}
            />
          ))}
        </div>
      </main>
    </>
  );
}
