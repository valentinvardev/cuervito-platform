import { FilasHueso, Hueso, Lienzo } from "../_components/hueso";

/**
 * Ventas: la tarjeta oscura con lo que ganó, y después la tabla.
 *
 * La tarjeta grande se dibuja con su fondo real y no como hueso gris: es lo
 * único de la pantalla que tiene color propio, y en gris el cambio al cargar
 * se ve como si algo se hubiera prendido.
 */
export default function Cargando() {
  return (
    <Lienzo titulo={150} bajada={280}>
      <section className="sum">
        <div className="card neto">
          <Hueso a={210} alto={12} />
          <Hueso a={260} alto={44} arriba={14} bloque />
          <Hueso a={330} alto={12} arriba={16} bloque />
        </div>
      </section>

      <section className="card">
        <FilasHueso n={6} clase="vt" />
      </section>
    </Lienzo>
  );
}
