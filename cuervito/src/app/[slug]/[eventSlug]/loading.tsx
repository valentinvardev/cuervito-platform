/**
 * Esqueleto de la página de venta.
 *
 * Esta pantalla tarda más que las del panel y no por nuestra culpa: cada foto
 * necesita una URL firmada de S3, así que antes del primer pixel hay una tanda
 * de firmas. Sin esqueleto, el atleta que abre el link desde el celular ve
 * blanco unos segundos y en una conexión mala se va antes de que cargue.
 *
 * Va con la forma de la plantilla encontrate, que es la que traen las cuentas
 * nuevas. No puede adaptarse a la plantilla de cada fotógrafo: loading.tsx se
 * dibuja ANTES de que exista la consulta que dice cuál usa. Lo que sí hace es
 * tomar los colores de los tokens compartidos (--bg-base, --text-primary), que
 * son los mismos nombres en las cuatro plantillas, así que en las oscuras sale
 * oscuro y en las claras claro, y sólo la disposición puede no coincidir.
 */
function Hueso({
  a,
  alto,
  radio = 8,
  arriba,
  bloque,
}: {
  a?: number | string;
  alto: number;
  radio?: number | string;
  arriba?: number;
  bloque?: boolean;
}) {
  return (
    <span
      className="et-sk"
      style={{
        display: bloque ? "block" : "inline-block",
        width: a ?? "100%",
        height: alto,
        borderRadius: radio,
        marginTop: arriba,
      }}
    />
  );
}

export default function Cargando() {
  return (
    <div className="et">
      <header className="et-top">
        <div className="et-marca">
          <Hueso a={32} alto={32} radio={9} />
          <span className="et-quien">
            <Hueso a={120} alto={13} bloque />
            <Hueso a={150} alto={10} arriba={5} bloque />
          </span>
        </div>
        <div className="et-carrito">
          <Hueso a={42} alto={42} radio={11} />
        </div>
      </header>

      <div className="et-in">
        <section className="et-hero">
          <Hueso a={210} alto={13} bloque />
          {/* Dos renglones de título: la mayoría de los nombres de evento
              ocupan dos, y con uno solo la página salta cuando llega el dato. */}
          <Hueso a="70%" alto={44} arriba={14} bloque />
          <Hueso a="45%" alto={44} arriba={8} bloque />
          <Hueso a={260} alto={17} arriba={18} bloque />
        </section>

        <section className="et-buscar">
          <div className="et-buscar-tit">
            <Hueso a={160} alto={16} bloque />
            <Hueso a={280} alto={13} arriba={5} bloque />
          </div>
          <Hueso alto={46} radio={11} bloque />
          <div className="et-o">o</div>
          <Hueso alto={72} radio={10} bloque />
        </section>

        <section className="et-grilla">
          {Array.from({ length: 12 }).map((_, i) => (
            <div className="et-foto et-sk" key={i} />
          ))}
        </section>
      </div>
    </div>
  );
}
