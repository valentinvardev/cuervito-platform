import type { PublicDiscount } from "../event-coverage-shell";

/**
 * Traducir los descuentos automáticos del evento a una frase que el atleta
 * entienda.
 *
 * Sólo los AUTOMÁTICOS. Los de código quedan afuera a propósito: un código
 * publicado en la misma página donde se compra no es un código, es un descuento
 * con un paso de más. El atleta lo ve, lo copia, lo pega y paga menos —o peor,
 * lo tipea mal y se va creyendo que el descuento era mentira—. Un código existe
 * para repartirlo aparte: al club, a los que corrieron el año pasado, a quien
 * se quiera. Mostrarlo acá lo convierte en un obstáculo para todos y en una
 * ventaja para nadie.
 *
 * La lógica de aplicarlos vive en el checkout, que es donde tiene que vivir: el
 * precio final lo decide el servidor. Esto es sólo el cartel, y existe porque un
 * descuento que nadie ve no descuenta nada.
 */
export type Promo = {
  texto: string;
  /** Cuántas fotos hay que llevar para que aplique. */
  desde: number;
  /** Cuánto se ahorra al llegar a esa cantidad, en pesos. */
  ahorro: number;
};

function pesos(n: number) {
  return "$" + Math.round(n).toLocaleString("es-AR");
}

export function elegirPromo(
  descuentos: PublicDiscount[],
  precioPorFoto: number,
): Promo | null {
  const vivos = descuentos.filter(
    (d) =>
      d.type !== "CODE" && (!d.expires || new Date(d.expires) > new Date()),
  );
  if (vivos.length === 0) return null;

  // Se elige UNO: el que más plata ahorra. Tres carteles de promoción arriba de
  // la grilla es ruido de tienda de saldos, y el atleta no puede combinar lo
  // que no entiende.
  const conValor = vivos.flatMap((d) => {
    if (d.type === "BUNDLE" && d.qty && d.price !== null) {
      // price es el precio POR FOTO a tarifa de paquete, no el total.
      const lista = d.qty * precioPorFoto;
      const conPaquete = d.qty * d.price;
      const ahorro = lista - conPaquete;
      return ahorro > 0
        ? [
            {
              texto: `Llevando ${d.qty} o más, cada foto te sale ${pesos(d.price)}`,
              desde: d.qty,
              ahorro,
            },
          ]
        : [];
    }
    if (d.type === "QTYPCT" && d.qty && d.value !== null) {
      const ahorro = (d.qty * precioPorFoto * d.value) / 100;
      return ahorro > 0
        ? [
            {
              texto: `Llevando ${d.qty} o más, ${d.value}% de descuento en todas`,
              desde: d.qty,
              ahorro,
            },
          ]
        : [];
    }
    return [];
  });

  return conValor.sort((a, b) => b.ahorro - a.ahorro)[0] ?? null;
}
