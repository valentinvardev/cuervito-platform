export default function Loading() {
  return (
    <>
      <nav className="nav">
        <div className="nav-left">
          <span
            className="skel"
            style={{ width: 100, height: 24, borderRadius: 6 }}
          />
        </div>
      </nav>

      <header className="hero">
        <div className="hero-cover" aria-hidden="true" />
        <div className="hero-inner">
          <div className="photog-row">
            <span
              className="skel"
              style={{
                width: 76,
                height: 76,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.18)",
              }}
            />
            <div style={{ flex: 1 }}>
              <span
                className="skel"
                style={{
                  width: 220,
                  height: 28,
                  display: "block",
                  marginBottom: 8,
                  background: "rgba(255,255,255,0.16)",
                }}
              />
              <span
                className="skel"
                style={{
                  width: 320,
                  height: 14,
                  display: "block",
                  background: "rgba(255,255,255,0.12)",
                }}
              />
            </div>
          </div>
        </div>
      </header>

      <main className="main">
        <span
          className="skel"
          style={{ width: 140, height: 22, display: "block", marginBottom: 14 }}
        />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 14,
          }}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <span
              key={i}
              className="skel"
              style={{ aspectRatio: "16/10", borderRadius: 14 }}
            />
          ))}
        </div>
      </main>
    </>
  );
}
