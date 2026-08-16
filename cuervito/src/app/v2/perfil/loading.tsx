import { Hueso, Lienzo } from "../_components/hueso";

/** Perfil: la columna de campos y la tarjeta de previa, pegada a la derecha. */
export default function Cargando() {
  return (
    <Lienzo titulo={130} bajada={300}>
      <div className="perfil">
        <div className="pcol">
          {[2, 2].map((campos, c) => (
            <section className="card blq" key={c}>
              <Hueso a={c === 0 ? 160 : 80} alto={15} />
              <Hueso a={280} alto={12} arriba={9} bloque />
              <div className="blq-b">
                {Array.from({ length: campos }).map((_, i) => (
                  <div className="campo" key={i}>
                    <Hueso a={70} alto={11} bloque />
                    <Hueso alto={i === 1 && c === 0 ? 78 : 38} radio="var(--r-2)" arriba={8} bloque />
                  </div>
                ))}
              </div>
            </section>
          ))}
          <Hueso a={170} alto={42} radio="var(--r-2)" />
        </div>

        <aside className="lado">
          <div className="card">
            <div className="card-h">
              <Hueso a={90} alto={15} />
            </div>
            <div style={{ display: "grid", justifyItems: "center", gap: 10, padding: "var(--s-4)" }}>
              <Hueso a={56} alto={56} radio="50%" />
              <Hueso a={130} alto={15} />
              <Hueso a={190} alto={11} />
              <Hueso a={150} alto={11} />
            </div>
          </div>
        </aside>
      </div>
    </Lienzo>
  );
}
