import { Hueso, Lienzo, TarjetaHueso } from "../_components/hueso";

/** Métodos de pago: la cuenta conectada arriba y las dos tarjetas abajo. */
export default function Cargando() {
  return (
    <Lienzo titulo={260} bajada={240}>
      <section className="metodo">
        <div className="metodo-h">
          <Hueso a={124} alto={30} />
          <Hueso a={92} alto={22} radio={100} />
        </div>
        <div className="metodo-d">
          {[0, 1, 2].map((i) => (
            <div key={i}>
              <Hueso a={70} alto={11} bloque />
              <Hueso a={i === 2 ? 92 : 140} alto={15} arriba={8} bloque />
            </div>
          ))}
        </div>
        <div className="metodo-f">
          <Hueso a={186} alto={32} radio="var(--r-2)" />
        </div>
      </section>

      <div className="duo">
        <TarjetaHueso titulo={200} lineas={4} />
        <TarjetaHueso titulo={130} lineas={5} />
      </div>
    </Lienzo>
  );
}
