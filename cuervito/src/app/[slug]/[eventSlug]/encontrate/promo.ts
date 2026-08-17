import type { PublicDiscount } from "../event-coverage-shell";

/**
 * Traducir los descuentos del evento a una frase que el atleta entienda.
 *
 * La lógica de aplicarlos vive en el checkout, que es donde tiene que vivir:
 * el precio final lo decide el servidor y no el navegador. Esto es sólo el
 * cartel, y existe porque un descuento que nadie ve no descuenta nada.
 *
 * Se elige UNO y no se listan todos. Tres carteles de promoción arriba de la
 * grilla es ruido de tienda de saldos, y además el atleta no puede combinar
 * lo que no entiende: se muestra el que más plata le ahorra.
 */
export type Promo = {
  texto: string;
  codigo: string | null;
  /** Cuántas fotos hay que llevar para que aplique, si es por cantidad. */
  desde: number | null;
};

function pesos(n: number) {
  return "$" + Math.round(n).toLocaleString("es-AR");
}

export function elegirPromo(
  descuentos: PublicDiscount[],
  precioPorFoto: number,
): Promo | null {
  const vivos = descuentos.filter(
    (d) => !d.expires || new Date(d.expires) > new Date(),
  );
  if (vivos.length === 0) return null;

  // Cuánto ahorra cada uno, en pesos, para poder compararlos entre sí. Los de
  // porcentaje se estiman sobre la cantidad que piden: es la única forma de
  // poner en la misma escala un "10% llevando 3" y un "las 5 por $7.000".
  const conValor = vivos.map((d) => {
    if (d.type === "BUNDLE" && d.qty && d.price !== null) {
      const lista = d.qty * precioPorFoto;
      return { d, ahorro: Math.max(0, lista - d.price) };
    }
    if (d.type === "QTYPCT" && d.qty && d.value !== null) {
      return { d, ahorro: (d.qty * precioPorFoto * d.value) / 100 };
    }
    if (d.type === "CODE" && d.value !== null) {
      // Sin cantidad de referencia, se estima sobre una foto: es lo mínimo que
      // se lleva alguien, así que no promete de más.
      const ahorro = d.kind === "PERCENT" ? (precioPorFoto * d.value) / 100 : d.value;
      return { d, ahorro };
    }
    return { d, ahorro: 0 };
  });

  const mejor = conValor.sort((a, b) => b.ahorro - a.ahorro)[0];
  if (!mejor || mejor.ahorro <= 0) return null;
  const d = mejor.d;

  if (d.type === "BUNDLE" && d.qty && d.price !== null) {
    return {
      texto: `Llevá ${d.qty} fotos por ${pesos(d.price)} — ahorrás ${pesos(mejor.ahorro)}`,
      codigo: null,
      desde: d.qty,
    };
  }
  if (d.type === "QTYPCT" && d.qty && d.value !== null) {
    return {
      texto: `Llevando ${d.qty} o más, ${d.value}% menos en todas`,
      codigo: null,
      desde: d.qty,
    };
  }
  const cuanto = d.kind === "PERCENT" ? `${d.value}%` : pesos(d.value ?? 0);
  return {
    texto: `Tenés ${cuanto} de descuento con el código`,
    codigo: d.code,
    desde: null,
  };
}

/**
 * Lo que falta para llegar a la promoción, ya con fotos en el carrito.
 *
 * Es el momento en que el descuento realmente mueve la aguja: alguien con tres
 * fotos elegidas y un "llevá 5 y ahorrás $2.000" agrega dos más. Antes de
 * elegir la primera, el mismo cartel es información; acá es una decisión.
 */
export function faltanPara(promo: Promo | null, enCarrito: number): number | null {
  if (!promo?.desde) return null;
  const faltan = promo.desde - enCarrito;
  return faltan > 0 && enCarrito > 0 ? faltan : null;
}
