import { Hueso } from "../_components/hueso";

/** Alta de evento: los tres pasos, el formulario y la columna de resumen. */
export default function Cargando() {
  return (
    <main className="canvas">
      <div className="canvas-in">
        <div className="head">
          <div>
            <Hueso a={90} alto={26} radio="var(--r-2)" bloque />
            <Hueso a={230} alto={34} arriba={12} bloque />
          </div>
        </div>

        <div className="wiz">
          <div>
            <div className="wpasos">
              {[0, 1, 2].map((i) => (
                <span className="wp" key={i}>
                  <Hueso a={26} alto={26} radio="50%" />
                  <Hueso a={110 - i * 10} alto={12} />
                </span>
              ))}
            </div>

            <div className="card" style={{ marginTop: "var(--s-5)" }}>
              <div className="blq-b">
                <div className="campo">
                  <Hueso a={70} alto={11} bloque />
                  <Hueso alto={38} radio="var(--r-2)" arriba={8} bloque />
                </div>
                <div className="par">
                  {[0, 1].map((i) => (
                    <div className="campo" key={i}>
                      <Hueso a={60} alto={11} bloque />
                      <Hueso alto={38} radio="var(--r-2)" arriba={8} bloque />
                    </div>
                  ))}
                </div>
                <div className="campo">
                  <Hueso a={80} alto={11} bloque />
                  <Hueso alto={150} radio="var(--r-2)" arriba={8} bloque />
                </div>
              </div>
            </div>
          </div>

          <aside className="lado">
            <div className="card">
              <div className="card-h">
                <Hueso a={120} alto={15} />
              </div>
              <div className="previa-ev">
                <div className="previa-cv" />
                <div className="previa-b">
                  <Hueso a={140} alto={14} bloque />
                  <Hueso a={100} alto={11} arriba={6} bloque />
                </div>
              </div>
            </div>
            <div className="card">
              <div className="card-h">
                <Hueso a={90} alto={15} />
              </div>
              <dl className="resumen">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div className="rs" key={i}>
                    <Hueso a={80} alto={12} />
                    <Hueso a={100 - i * 8} alto={12} />
                  </div>
                ))}
              </dl>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
