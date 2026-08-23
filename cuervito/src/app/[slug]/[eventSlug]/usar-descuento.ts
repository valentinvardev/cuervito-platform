"use client";

import { useEffect, useRef, useState } from "react";

import { mejorAutomatico, type DescuentoBase } from "~/lib/descuentos";

/**
 * Lo que descuenta el carrito, mientras el comprador lo arma.
 *
 * Dos mitades con tiempos distintos, y esa es toda la razón de que exista este
 * hook en vez de dos pedazos sueltos en cada carrito:
 *
 * · Los AUTOMÁTICOS (pack, porcentaje por cantidad) se calculan acá mismo, sin
 *   red. Dependen sólo de la cantidad de fotos, que el navegador ya sabe, y
 *   tienen que actualizarse en el mismo cuadro en que se agrega la quinta foto.
 *   Un descuento por cantidad que aparece medio segundo tarde se lee como que
 *   no aplicó.
 *
 * · El CÓDIGO va al servidor. No se puede validar acá porque para eso habría
 *   que mandarle la lista de códigos al navegador, y ahí deja de ser un código:
 *   cualquiera lo lee con las herramientas de desarrollo. Se consulta con
 *   retardo mientras se tipea, así "VER" no se rechaza antes de terminar de
 *   escribir "VERANO20".
 *
 * El código REEMPLAZA al automático, no se suma: es la regla del checkout, y
 * si el carrito prometiera la suma, el servidor cobraría otra cosa.
 */

/** Cuánto se espera después de la última tecla antes de preguntar. */
const RETARDO_MS = 450;

export type EstadoDescuento = {
  descuentoCentavos: number;
  totalCentavos: number;
  /** "20% con VERANO20", "Pack de 5 o más". Null si no hay descuento. */
  texto: string | null;
  /** El código se escribió entero y no sirve. */
  codigoInvalido: boolean;
  /** Hay una consulta en vuelo: el total todavía puede cambiar. */
  validando: boolean;
};

export function useDescuento({
  eventId,
  photoIds,
  subtotalCentavos,
  descuentos,
  codigo,
}: {
  eventId: string;
  photoIds: string[];
  subtotalCentavos: number;
  descuentos: DescuentoBase[];
  codigo: string;
}): EstadoDescuento {
  const limpio = codigo.trim();

  // El automático, ya. Se recalcula en cada render y no cuesta nada.
  const automatico = mejorAutomatico(descuentos, subtotalCentavos, photoIds.length);

  const [delServidor, setDelServidor] = useState<{
    descuentoCentavos: number;
    texto: string | null;
    codigoInvalido: boolean;
  } | null>(null);
  const [validando, setValidando] = useState(false);

  // Para descartar respuestas viejas: si alguien tipea rápido, la respuesta de
  // "VERAN" puede llegar después que la de "VERANO20" y pisarla.
  const turno = useRef(0);

  const clave = `${limpio}|${photoIds.join(",")}`;

  useEffect(() => {
    if (!limpio) {
      setDelServidor(null);
      setValidando(false);
      return;
    }
    if (photoIds.length === 0) return;

    const mio = ++turno.current;
    setValidando(true);

    const reloj = setTimeout(() => {
      void (async () => {
        try {
          const r = await fetch("/api/mp/descuento", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ eventId, photoIds, code: limpio }),
          });
          if (turno.current !== mio) return;
          if (!r.ok) {
            setDelServidor({ descuentoCentavos: 0, texto: null, codigoInvalido: true });
            return;
          }
          const d = (await r.json()) as {
            descuentoCentavos: number;
            texto: string | null;
            codigoInvalido: boolean;
          };
          if (turno.current !== mio) return;
          setDelServidor(d);
        } catch {
          // Sin red no se puede saber si el código sirve. NO se marca como
          // inválido: decirle "código inválido" a alguien que tiene el código
          // bien es peor que no decir nada, y el checkout lo va a validar.
          if (turno.current === mio) setDelServidor(null);
        } finally {
          if (turno.current === mio) setValidando(false);
        }
      })();
    }, RETARDO_MS);

    return () => clearTimeout(reloj);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, eventId, subtotalCentavos]);

  // Con código escrito manda lo que dijo el servidor; sin código, el automático.
  const descuentoCentavos = limpio
    ? (delServidor?.descuentoCentavos ?? 0)
    : (automatico?.centavos ?? 0);

  const texto = limpio ? (delServidor?.texto ?? null) : (automatico?.texto ?? null);

  return {
    descuentoCentavos,
    totalCentavos: Math.max(subtotalCentavos - descuentoCentavos, 0),
    texto,
    codigoInvalido: !!limpio && !validando && !!delServidor?.codigoInvalido,
    validando,
  };
}
