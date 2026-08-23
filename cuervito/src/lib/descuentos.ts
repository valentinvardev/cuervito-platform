/**
 * La cuenta de los descuentos, en un solo lugar.
 *
 * Vivía sólo adentro de /api/mp/checkout, así que el carrito no podía mostrar
 * el precio con descuento sin copiar la fórmula —y una fórmula copiada se
 * desincroniza el día que alguien toca una de las dos—. El carrito mostraba el
 * subtotal como total y avisaba "los descuentos se aplican al pagar", que para
 * el que suma cinco fotos esperando el descuento se lee como que no funciona.
 *
 * Es un módulo PURO: no importa la base ni nada del servidor, para que lo pueda
 * usar tanto el checkout como el navegador. El servidor sigue teniendo la
 * última palabra sobre el precio; esto sólo hace que las dos cuentas den igual.
 *
 * Los redondeos son los que ya estaban, no los que serían más prolijos: si acá
 * redondeara distinto, el carrito diría un peso menos que el checkout y el
 * comprador vería cambiar el número justo al pagar.
 */

export type DescuentoBase = {
  id: string;
  type: "CODE" | "BUNDLE" | "QTYPCT";
  code?: string | null;
  /** "pct" | "fixed", sólo para los de código. */
  kind?: string | null;
  value: number | null;
  qty: number | null;
  price: number | null;
  maxUses?: number | null;
  usageCount?: number | null;
};

export type Aplicado = {
  id: string;
  centavos: number;
  /** Para mostrar en el carrito: "20% con VERANO20", "Pack de 5". */
  texto: string;
};

/** Los que todavía sirven: ni vencidos ni agotados. */
export function vigentes<T extends DescuentoBase & { expires?: string | Date | null }>(
  descuentos: T[],
  ahora = new Date(),
): T[] {
  return descuentos.filter((d) => {
    if (d.expires && new Date(d.expires) <= ahora) return false;
    if (d.maxUses != null && (d.usageCount ?? 0) >= d.maxUses) return false;
    return true;
  });
}

/**
 * El descuento de un código.
 *
 * Devuelve null si el código no existe, venció o se agotó. Quien llame decide
 * si eso es un error para mostrar o simplemente "no hay descuento".
 */
export function porCodigo(
  descuentos: DescuentoBase[],
  codigo: string,
  subtotalCentavos: number,
): Aplicado | null {
  const buscado = codigo.trim().toUpperCase();
  if (!buscado) return null;

  const d = vigentes(descuentos).find((x) => x.type === "CODE" && x.code === buscado);
  if (d?.value == null) return null;

  const centavos =
    d.kind === "pct"
      ? Math.floor((subtotalCentavos * d.value) / 100)
      : // Nunca deja el total en cero: un pago de $0 en Mercado Pago no existe,
        // así que el fijo se topea un centavo abajo del subtotal.
        Math.min(Math.round(d.value * 100), subtotalCentavos - 1);

  return {
    id: d.id,
    centavos: Math.max(0, centavos),
    texto: d.kind === "pct" ? `${d.value}% con ${buscado}` : `${buscado}`,
  };
}

/**
 * El mejor descuento automático para esa cantidad de fotos.
 *
 * Gana el que más plata ahorra. No se acumulan: dos promociones sumadas dan un
 * número que el fotógrafo no puso en ningún lado.
 */
export function mejorAutomatico(
  descuentos: DescuentoBase[],
  subtotalCentavos: number,
  cantidad: number,
): Aplicado | null {
  let mejor: Aplicado | null = null;

  for (const d of vigentes(descuentos)) {
    let centavos = 0;
    let texto = "";

    if (d.type === "BUNDLE" && d.qty !== null && d.price !== null && cantidad >= d.qty) {
      // price es el precio POR FOTO a tarifa de paquete, no el total.
      centavos = subtotalCentavos - Math.round(d.price * 100) * cantidad;
      texto = `Pack de ${d.qty} o más`;
    } else if (d.type === "QTYPCT" && d.qty !== null && d.value !== null && cantidad >= d.qty) {
      centavos = Math.floor((subtotalCentavos * d.value) / 100);
      texto = `${d.value}% por llevar ${d.qty} o más`;
    } else {
      continue;
    }

    if (centavos > (mejor?.centavos ?? 0)) mejor = { id: d.id, centavos, texto };
  }

  return mejor;
}

/**
 * Lo que termina pagando, con la regla de precedencia.
 *
 * El código REEMPLAZA a los automáticos, no se suma: es la regla que ya tenía
 * el checkout y la que hay que respetar en el carrito, porque si no el carrito
 * promete la suma de los dos y el servidor cobra uno.
 */
export function calcular({
  descuentos,
  subtotalCentavos,
  cantidad,
  codigo,
}: {
  descuentos: DescuentoBase[];
  subtotalCentavos: number;
  cantidad: number;
  codigo?: string | null;
}): { aplicado: Aplicado | null; totalCentavos: number } {
  const aplicado = codigo?.trim()
    ? porCodigo(descuentos, codigo, subtotalCentavos)
    : mejorAutomatico(descuentos, subtotalCentavos, cantidad);

  return {
    aplicado,
    totalCentavos: Math.max(subtotalCentavos - (aplicado?.centavos ?? 0), 0),
  };
}
