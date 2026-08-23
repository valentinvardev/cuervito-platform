import { Hueso } from "../../_components/hueso";

/**
 * El evento: la banda con la portada, los cuatro números, las solapas y la
 * grilla de fotos.
 *
 * La banda va con su fondo real y su relación de aspecto, no como un hueso
 * gris: ocupa el ancho entero y es lo primero que se ve. Un rectángulo gris de
 * ese tamaño cambiando a una foto es el salto más grande de la pantalla.
 *
 * El Lienzo no se usa acá porque esta pantalla no tiene el encabezado de título
 * y bajada: arranca directo con la banda.
 */
export default function Cargando() {
  return (
    <main className="canvas">
      <div className="canvas-in">
        <section className="banda">
          <div className="banda-in">
            <div>
              <div className="banda-meta">
                <Hueso a={96} alto={22} radio={100} />
                <Hueso a={170} alto={12} />
              </div>
              <Hueso a={330} alto={30} arriba={12} bloque />
            </div>
          </div>
        </section>

        <section className="cifras">
          {[0, 1, 2, 3].map((i) => (
            <div className="card cifra" key={i}>
              <div className="c-top">
                <Hueso a={70} alto={12} />
                <Hueso a={15} alto={15} />
              </div>
              <Hueso a={110} alto={30} arriba={14} bloque />
              <Hueso a={128} alto={11} arriba={12} bloque />
            </div>
          ))}
        </section>

        {/* Cada hueso va dentro de un .solapa y no suelto en la barra: el
            padding inferior de 12px y el borde son de la solapa, y sin ellos la
            barra medía 18px de alto contra los 30 reales. Treinta píxeles de
            diferencia es exactamente el salto que el esqueleto viene a evitar. */}
        <div className="solapas">
          {[86, 78, 84, 56].map((a, i) => (
            <span className="solapa" key={i}>
              <Hueso a={a} alto={17} />
            </span>
          ))}
        </div>

        <section className="panel-s" data-activo="1">
          <div className="soltar">
            <Hueso a={40} alto={40} radio="var(--r-3)" />
            <Hueso a={170} alto={14} />
            <Hueso a={280} alto={12} />
          </div>

          <div className="fg">
            {/* .ft ya trae su relación 3/2 y su fondo, así que la celda vacía
                ocupa exactamente el lugar que va a ocupar la foto. */}
            {Array.from({ length: 12 }).map((_, i) => (
              <div className="ft sk" key={i} />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
