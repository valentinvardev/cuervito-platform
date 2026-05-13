export default function Loading() {
  return (
    <>
      <nav className="nav">
        <div className="nav-left">
          <span
            className="skel"
            style={{ width: 140, height: 22, borderRadius: 6 }}
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
                  width: 200,
                  height: 26,
                  display: "block",
                  marginBottom: 8,
                  background: "rgba(255,255,255,0.16)",
                }}
              />
              <span
                className="skel"
                style={{
                  width: 280,
                  height: 13,
                  display: "block",
                  background: "rgba(255,255,255,0.12)",
                }}
              />
            </div>
          </div>
          <div className="event-strip" style={{ marginTop: 22 }}>
            <span
              className="skel"
              style={{
                width: 260,
                height: 20,
                background: "rgba(255,255,255,0.16)",
              }}
            />
          </div>
        </div>
      </header>

      <main className="main">
        {/* Search bar */}
        <span
          className="skel"
          style={{
            display: "block",
            width: "100%",
            height: 56,
            borderRadius: 14,
            marginBottom: 18,
          }}
        />

        {/* Photo grid */}
        <div className="photo-grid">
          {Array.from({ length: 12 }).map((_, i) => (
            <span
              key={i}
              className="skel"
              style={{ aspectRatio: "3/2", borderRadius: 8 }}
            />
          ))}
        </div>
      </main>
    </>
  );
}
