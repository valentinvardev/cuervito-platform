/**
 * Esqueleto mientras el servidor arma la pantalla.
 *
 * Como el armazón vive en el layout, esto reemplaza SÓLO el lienzo: el riel y
 * la barra se quedan quietos y lo único que cambia es el contenido. Eso es lo
 * que hace que cambiar de pantalla se sienta inmediato aunque el servidor
 * tarde: hay respuesta visual en el mismo cuadro del click.
 *
 * Además habilita la precarga de verdad. Next sólo puede precargar rutas
 * dinámicas hasta su límite de Suspense; sin este archivo no hay límite que
 * precargar y el <Link prefetch> no sirve para nada.
 */
export default function Cargando() {
  return (
    <main className="canvas">
      <div className="canvas-in">
        <div className="head">
          <div>
            <div className="sk" style={{ width: 260, height: 34 }} />
            <div className="sk" style={{ width: 340, height: 14, marginTop: 12 }} />
          </div>
        </div>

        <section className="kpis">
          {[0, 1, 2].map((i) => (
            <div className="card kpi" key={i}>
              <div className="k-top">
                <span className="sk" style={{ width: 96, height: 12 }} />
                <span className="sk" style={{ width: 15, height: 15 }} />
              </div>
              <div className="sk" style={{ width: 150, height: 34, marginTop: 16 }} />
              <div className="sk" style={{ width: 118, height: 12, marginTop: 14 }} />
            </div>
          ))}
        </section>

        <section className="duo">
          <div className="card">
            <div className="card-h">
              <div className="sk" style={{ width: 80, height: 15 }} />
            </div>
            <div className="sk" style={{ height: 190, borderRadius: "var(--r-2)" }} />
          </div>
          <div className="card">
            <div className="card-h">
              <div className="sk" style={{ width: 150, height: 15 }} />
            </div>
            {[68, 80, 60].map((w, i) => (
              <div className="row at" key={i}>
                <span className="sk" style={{ width: 26, height: 26, borderRadius: 7 }} />
                <span>
                  <span className="sk" style={{ display: "block", width: `${w}%`, height: 12 }} />
                  <span
                    className="sk"
                    style={{ display: "block", width: `${w - 15}%`, height: 10, marginTop: 6 }}
                  />
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
