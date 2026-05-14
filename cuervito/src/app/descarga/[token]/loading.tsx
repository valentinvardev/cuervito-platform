/**
 * Skeleton for /descarga/[token]. Mirrors the final layout: top nav,
 * "Gracias por tu compra" hero, summary card (4 fields), photo grid.
 * Same DOM structure means no layout shift when the server component
 * resolves and Next swaps the skeleton out.
 */
export default function DescargaLoading() {
  return (
    <>
      <header className="nav">
        <span className="logo" aria-hidden="true">
          cuerv<span className="logo-dot"></span>to
        </span>
      </header>

      <main className="wrap">
        <section className="hero">
          <div className="check-circle">
            <i className="ti ti-check" />
          </div>
          <div className="eyebrow-success">Cargando…</div>
          <h1 style={{ visibility: "hidden" }}>
            Gracias por
            <br />
            tu compra.
          </h1>
          <p className="lede" style={{ visibility: "hidden" }}>
            placeholder
          </p>
        </section>

        <div className="summary-card">
          <div className="meta">
            {Array.from({ length: 4 }).map((_, i) => (
              <div className="item" key={i}>
                <div className="lab">
                  <span
                    className="skel"
                    style={{ width: 64, height: 11, display: "inline-block" }}
                  />
                </div>
                <div className="val">
                  <span
                    className="skel"
                    style={{
                      width: 120,
                      height: 16,
                      display: "inline-block",
                      marginTop: 4,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="section-h">
          <h2>
            <span
              className="skel"
              style={{ width: 120, height: 22, display: "inline-block" }}
            />
          </h2>
        </div>

        <div className="photo-grid">
          {Array.from({ length: 8 }).map((_, i) => (
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
