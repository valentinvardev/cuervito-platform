import { type CSSProperties } from "react";

import { COMISION } from "~/lib/producto";

import { AlVerse } from "./al-verse";

/**
 * Cómo se parte un pago: una barra que entra entera y se separa en lo tuyo y
 * la comisión, en el mismo movimiento. Eso es lo que se quiere mostrar: que
 * no hay un paso intermedio donde la plata queda en otro lado.
 */

const EJEMPLO = 10_000;

function pesos(n: number) {
  return `$${n.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
}

export function DivisionCobro({ sin }: { sin?: boolean }) {
  const pct = sin ? COMISION.sinReconocimiento : COMISION.conReconocimiento;
  const tuyo = EJEMPLO * (1 - pct / 100);

  return (
    <AlVerse
      className="ilus-pago"
      etiqueta={`Una compra de ${pesos(EJEMPLO)}: ${pesos(tuyo)} entran a tu Mercado Pago en el momento y ${pesos(EJEMPLO - tuyo)} son la comisión, en la misma operación.`}
    >
      <div className="pago-cab">
        <span className="label">El atleta paga</span>
        <b className="tnum">{pesos(EJEMPLO)}</b>
      </div>

      <div className="pago-barra" style={{ "--tuyo": `${100 - pct}%` } as CSSProperties}>
        <span className="pago-tuyo">
          <span className="tnum">{pesos(tuyo)}</span>
        </span>
        <span className="pago-comision">
          <span className="tnum">{pct}%</span>
        </span>
      </div>

      <div className="pago-pie">
        <span className="pago-pie-tuyo">
          <i /> A tu Mercado Pago, <b>en el momento</b>
        </span>
        <span className="pago-pie-com">Comisión, en la misma operación</span>
      </div>
    </AlVerse>
  );
}
