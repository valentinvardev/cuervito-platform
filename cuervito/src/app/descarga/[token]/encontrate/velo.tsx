"use client";

import { Check } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * El velo de "pago confirmado".
 *
 * Tapa TODO mientras corre. Ése es el arreglo del bug que había: en la versión
 * anterior el comprador llegaba de Mercado Pago y veía primero el esqueleto de
 * la galería —encabezado, resumen, grilla— y recién después la animación de
 * confirmación. Quedaba al revés: la página mostraba las fotos entregadas y
 * después preguntaba si el pago había salido.
 *
 * La causa no era la animación: era loading.tsx, que Next dibuja mientras
 * resuelve el componente de servidor y que copiaba la galería final. Este
 * componente llega recién con el JS, así que llegaba tarde por definición.
 *
 * La solución completa tiene dos mitades. Esta es la segunda; la primera es el
 * script bloqueante del layout, que marca el documento antes del primer pintado
 * y hace que el CSS esconda el esqueleto desde el cuadro cero.
 */
const CONFIRMANDO_MS = 1600;
const APROBADO_MS = 1500;
const SALIDA_MS = 420;

export function Velo({ alTerminar }: { alTerminar: () => void }) {
  const [estado, setEstado] = useState<"confirmando" | "ok">("confirmando");
  const [saliendo, setSaliendo] = useState(false);

  useEffect(() => {
    const relojes: ReturnType<typeof setTimeout>[] = [];
    relojes.push(setTimeout(() => setEstado("ok"), CONFIRMANDO_MS));
    relojes.push(setTimeout(() => setSaliendo(true), CONFIRMANDO_MS + APROBADO_MS));
    relojes.push(
      setTimeout(() => {
        // La marca del <html> se saca recién acá: es la que mantiene escondido
        // el esqueleto, y sacarla antes lo dejaría asomar por debajo del velo
        // mientras se desvanece.
        document.documentElement.dataset.pago = "";
        alTerminar();
      }, CONFIRMANDO_MS + APROBADO_MS + SALIDA_MS),
    );
    return () => {
      for (const r of relojes) clearTimeout(r);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="eg-velo"
      data-estado={estado}
      data-fuera={saliendo ? "1" : ""}
      role="status"
      aria-live="polite"
    >
      <div className="eg-velo-in">
        <div className="eg-anillo">
          <svg viewBox="0 0 76 76" aria-hidden="true">
            <circle className="pista" />
            <circle className="arco" />
          </svg>
          <span className="eg-tilde">
            <Check strokeWidth={3} />
          </span>
        </div>

        {estado === "confirmando" ? (
          <>
            <h1>Confirmando tu pago</h1>
            <p>Un segundo, estamos hablando con Mercado Pago.</p>
          </>
        ) : (
          <>
            <h1>¡Pago confirmado!</h1>
            <p>Ya son tuyas. Te las mostramos para que las bajes.</p>
          </>
        )}
      </div>
    </div>
  );
}
