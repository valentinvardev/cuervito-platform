import { Hueso, Lienzo } from "../_components/hueso";

/** Ayuda: la franja de contacto, las guías y las preguntas. */
export default function Cargando() {
  return (
    <Lienzo titulo={120} bajada={290}>
      <section className="contacto">
        <Hueso a={44} alto={44} radio="var(--r-2)" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <Hueso a={230} alto={17} bloque />
          <Hueso a={330} alto={12} arriba={8} bloque />
        </div>
        <Hueso a={150} alto={38} radio="var(--r-2)" />
      </section>

      <section className="card">
        <div className="card-h">
          <Hueso a={110} alto={15} />
        </div>
        <div className="guias">
          {Array.from({ length: 4 }).map((_, i) => (
            <div className="gu" key={i}>
              <Hueso a={30} alto={30} radio="var(--r-2)" />
              <Hueso a={`${76 - i * 9}%`} alto={13} arriba={10} bloque />
              <Hueso a={`${58 - i * 6}%`} alto={11} arriba={6} bloque />
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="card-h">
          <Hueso a={150} alto={15} />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div className="row" key={i} style={{ pointerEvents: "none" }}>
            <Hueso a={`${68 - (i % 4) * 8}%`} alto={13} />
          </div>
        ))}
      </section>
    </Lienzo>
  );
}
