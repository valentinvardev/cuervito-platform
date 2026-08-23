import { Hueso, Lienzo } from "../_components/hueso";

/**
 * Mi página: los controles a la izquierda y el marco de la previa a la derecha.
 *
 * El marco se dibuja con su alto real. Es lo más grande de la pantalla y si el
 * esqueleto lo deja bajo, todo lo de abajo se desplaza cuando entra el iframe.
 */
export default function Cargando() {
  return (
    <Lienzo titulo={170} bajada={330}>
      <div className="tienda">
        <div className="ctrl">
          {[
            { t: 110, campos: 1 },
            { t: 100, campos: 3 },
            { t: 70, campos: 0 },
          ].map((b, i) => (
            <section className="card blq" key={i}>
              <Hueso a={b.t} alto={15} />
              <Hueso a={300} alto={12} arriba={9} bloque />
              <div className="blq-b">
                {b.campos > 0 ? (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: `repeat(${b.campos}, 1fr)`,
                      gap: "var(--s-3)",
                    }}
                  >
                    {Array.from({ length: b.campos }).map((_, j) => (
                      <Hueso key={j} alto={b.campos === 1 ? 40 : 96} radio="var(--r-2)" bloque />
                    ))}
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 8 }}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <Hueso key={j} a={28} alto={28} radio="50%" />
                    ))}
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>

        <div className="previa">
          <div className="previa-h">
            <Hueso a={70} alto={12} />
            <Hueso a={168} alto={30} radio={100} />
          </div>
          <div className="marco">
            <div className="crome">
              <i />
              <i />
              <i />
              <Hueso a={190} alto={11} />
            </div>
            <div className="previa-real" style={{ height: 315 }} />
          </div>
        </div>
      </div>
    </Lienzo>
  );
}
