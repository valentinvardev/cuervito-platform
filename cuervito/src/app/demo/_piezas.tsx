/**
 * Lo que comparten las dos demos grabables.
 *
 * Son dos videos que se van a ver seguidos, así que la marca y el cierre tienen
 * que ser los mismos en los dos: si cada uno remata distinto, se leen como
 * piezas de productos distintos.
 */

/**
 * El isotipo, superpuesto en la barra de arriba.
 *
 * Va SÓLO en la demo. En la tienda el encabezado es del fotógrafo —su logo, su
 * nombre, su dirección— y meter el nuestro ahí contradice justo lo que
 * vendemos: que el atleta le compra a él y no a una galería con el logo de otro
 * arriba. En un video promocional sí hace falta que se vea de quién es el
 * producto, así que se superpone y no se toca el encabezado de verdad.
 */
export function Marca() {
  return (
    <div className="demo-marca" aria-hidden>
      <i />
    </div>
  );
}

/**
 * La pantalla de cierre.
 *
 * La toma termina nombrando lo que acaba de pasar. Sin esto el video corta en
 * medio de una pantalla cualquiera y el que lo mira se queda sin saber si eso
 * era el final o si se colgó.
 */
export function Celebracion({ titulo, detalle }: { titulo: string; detalle: string }) {
  return (
    <div className="demo-fin">
      <svg viewBox="0 0 104 104" aria-hidden>
        <circle className="aro" cx="52" cy="52" r="48" />
        <path className="pipa" d="M34 53 L47 66 L71 39" />
      </svg>
      <h2>{titulo}</h2>
      <p>{detalle}</p>
    </div>
  );
}
