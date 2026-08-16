import { Hueso, Lienzo } from "./_components/hueso";

/**
 * Esqueleto del inicio.
 *
 * Como el armazón vive en el layout, esto reemplaza SÓLO el lienzo: el riel y
 * la barra se quedan quietos y lo único que cambia es el contenido. Eso es lo
 * que hace que cambiar de pantalla se sienta inmediato aunque el servidor
 * tarde: hay respuesta visual en el mismo cuadro del click.
 *
 * Además habilita la precarga de verdad. Next sólo puede precargar rutas
 * dinámicas hasta su límite de Suspense; sin este archivo no hay límite que
 * precargar y el <Link prefetch> no sirve para nada.
 *
 * OJO: este archivo cubre /v2 y también cualquier pantalla hija que no tenga el
 * suyo. Antes era el único que había, así que entrar a Ventas o a Perfil
 * mostraba esta forma —tres números y dos columnas— y después la pantalla se
 * reacomodaba entera. Cada pantalla tiene ahora su loading.tsx; al agregar una
 * nueva hay que agregarle el suyo o hereda éste.
 */
export default function Cargando() {
  return (
    <Lienzo titulo={260} bajada={340}>
      <section className="kpis">
        {[0, 1, 2].map((i) => (
          <div className="card kpi" key={i}>
            <div className="k-top">
              <Hueso a={96} alto={12} />
              <Hueso a={15} alto={15} />
            </div>
            <Hueso a={150} alto={34} arriba={16} bloque />
            <Hueso a={118} alto={12} arriba={14} bloque />
          </div>
        ))}
      </section>

      <section className="duo">
        <div className="card">
          <div className="card-h">
            <Hueso a={80} alto={15} />
          </div>
          {/* El gráfico va con su alto real: es el bloque más alto de la
              pantalla y si el hueso queda corto, todo lo de abajo se corre
              cuando entran los datos. */}
          <Hueso alto={190} radio="var(--r-2)" bloque />
        </div>
        <div className="card">
          <div className="card-h">
            <Hueso a={150} alto={15} />
          </div>
          {[68, 80, 60].map((w, i) => (
            <div className="row at" key={i} style={{ pointerEvents: "none" }}>
              <Hueso a={26} alto={26} radio={7} />
              <span style={{ minWidth: 0 }}>
                <Hueso a={`${w}%`} alto={12} bloque />
                <Hueso a={`${w - 15}%`} alto={10} arriba={6} bloque />
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="duo">
        {[0, 1].map((c) => (
          <div className="card" key={c}>
            <div className="card-h">
              <Hueso a={c === 0 ? 110 : 130} alto={15} />
              <Hueso a={84} alto={26} radio="var(--r-2)" />
            </div>
            {[0, 1, 2].map((i) => (
              <div className="row" key={i} style={{ pointerEvents: "none" }}>
                <Hueso a={34} alto={34} radio={c === 0 ? 6 : "50%"} />
                <span style={{ minWidth: 0 }}>
                  <Hueso a={`${74 - i * 11}%`} alto={13} bloque />
                  <Hueso a={`${52 - i * 9}%`} alto={10} arriba={6} bloque />
                </span>
                <Hueso a={72} alto={12} />
              </div>
            ))}
          </div>
        ))}
      </section>
    </Lienzo>
  );
}
