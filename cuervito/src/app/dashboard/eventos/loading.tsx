import { Hueso, Lienzo } from "../_components/hueso";

/**
 * Eventos: una grilla de tarjetas con portada.
 *
 * Seis y no tres: la grilla es auto-fill de 286px, así que en un monitor ancho
 * entran cuatro por fila. Con tres huesos la primera fila quedaba coja y al
 * llegar los datos saltaba.
 */
export default function Cargando() {
  return (
    <Lienzo titulo={190} bajada={260}>
      <section className="evs">
        {Array.from({ length: 6 }).map((_, i) => (
          <div className="ec" key={i}>
            <div className="ec-cv" />
            <div className="ec-b">
              <Hueso a={`${78 - (i % 3) * 14}%`} alto={16} bloque />
              <Hueso a={`${58 - (i % 3) * 8}%`} alto={12} arriba={7} bloque />
            </div>
            {/* El pie es .ec-st, que trae el margin-top:auto que empuja los
                números abajo y la línea entre las dos columnas. Con un div
                inventado la tarjeta quedaba más baja que la de verdad. */}
            <div className="ec-st">
              <div>
                <Hueso a={44} alto={10} bloque />
                <Hueso a={62} alto={17} arriba={5} bloque />
              </div>
              <div>
                <Hueso a={54} alto={10} bloque />
                <Hueso a={78} alto={17} arriba={5} bloque />
              </div>
            </div>
          </div>
        ))}
      </section>
    </Lienzo>
  );
}
