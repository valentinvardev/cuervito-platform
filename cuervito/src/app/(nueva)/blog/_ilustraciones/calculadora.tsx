"use client";

import { useId, useState } from "react";

import { COMISION } from "~/lib/producto";

/**
 * La cuenta del post de precios, con los números de cada uno.
 *
 * Los valores de arriba son los del ejemplo del post (400 corredores, uno de
 * cada diez compra, el evento cuesta lo que 12 fotos), así lo que se lee y lo
 * que se toca dicen lo mismo. No son una recomendación de precio y lo dice.
 *
 * Lo que más sirve no es el total: es cuántas fotos hay que vender para cubrir
 * el evento. Ese número se puede comparar con el evento anterior.
 */

function pesos(n: number) {
  return `$${Math.round(n).toLocaleString("es-AR")}`;
}

function Campo({
  etiqueta,
  ayuda,
  children,
}: {
  etiqueta: string;
  ayuda?: string;
  children: (id: string) => React.ReactNode;
}) {
  const id = useId();
  return (
    <div className="calc-campo">
      <label htmlFor={id}>{etiqueta}</label>
      {children(id)}
      {ayuda && <small>{ayuda}</small>}
    </div>
  );
}

export function Calculadora() {
  const [participantes, setParticipantes] = useState(400);
  const [compran, setCompran] = useState(10);
  const [porComprador, setPorComprador] = useState(1.8);
  const [precio, setPrecio] = useState(5000);
  const [costos, setCostos] = useState(60000);
  const [conBusqueda, setConBusqueda] = useState(true);

  const pct = conBusqueda ? COMISION.conReconocimiento : COMISION.sinReconocimiento;
  const compradores = Math.round((participantes * compran) / 100);
  const fotos = Math.round(compradores * porComprador);
  const bruto = fotos * precio;
  const comision = (bruto * pct) / 100;
  const queda = bruto - comision - costos;
  const netoPorFoto = precio * (1 - pct / 100);
  const equilibrio = netoPorFoto > 0 ? Math.ceil(costos / netoPorFoto) : 0;

  // La barra se mide contra lo que sea más grande: lo que entra o lo que
  // cuesta. Si el evento da pérdida, los costos se pasan del total y se ve.
  const escala = Math.max(bruto, costos + comision, 1);
  const ancho = (n: number) => `${Math.max(0, (n / escala) * 100)}%`;

  const numero = (set: (n: number) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const n = Number(e.target.value);
    set(Number.isFinite(n) && n >= 0 ? n : 0);
  };

  return (
    <div className="calc">
      <div className="calc-entradas">
        <Campo etiqueta="Participantes">
          {(id) => (
            <input id={id} type="number" inputMode="numeric" min={0} value={participantes} onChange={numero(setParticipantes)} />
          )}
        </Campo>
        <Campo etiqueta={`Compran: ${compran}%`} ayuda="Medilo en tus eventos anteriores">
          {(id) => (
            <input id={id} type="range" min={1} max={40} step={1} value={compran} onChange={numero(setCompran)} />
          )}
        </Campo>
        <Campo
          etiqueta={`Fotos por comprador: ${porComprador.toLocaleString("es-AR")}`}
          ayuda="Con packs, sube"
        >
          {(id) => (
            <input id={id} type="range" min={1} max={5} step={0.1} value={porComprador} onChange={numero(setPorComprador)} />
          )}
        </Campo>
        <Campo etiqueta="Precio por foto ($)">
          {(id) => (
            <input id={id} type="number" inputMode="numeric" min={0} step={100} value={precio} onChange={numero(setPrecio)} />
          )}
        </Campo>
        <Campo etiqueta="Lo que te cuesta el evento ($)" ayuda="Traslado, horas, equipo">
          {(id) => (
            <input id={id} type="number" inputMode="numeric" min={0} step={1000} value={costos} onChange={numero(setCostos)} />
          )}
        </Campo>
        <div className="calc-campo">
          <span className="calc-rotulo">Búsqueda por cara y número</span>
          <div className="calc-opciones" role="radiogroup" aria-label="Búsqueda por cara y número">
            <button type="button" role="radio" aria-checked={conBusqueda} onClick={() => setConBusqueda(true)}>
              Sí · {COMISION.conReconocimiento}%
            </button>
            <button type="button" role="radio" aria-checked={!conBusqueda} onClick={() => setConBusqueda(false)}>
              Sólo galería · {COMISION.sinReconocimiento}%
            </button>
          </div>
        </div>
      </div>

      <div className="calc-salida" aria-live="polite">
        <dl className="calc-cifras">
          <div>
            <dt>Fotos vendidas</dt>
            <dd className="tnum">{fotos.toLocaleString("es-AR")}</dd>
          </div>
          <div>
            <dt>Entra por ventas</dt>
            <dd className="tnum">{pesos(bruto)}</dd>
          </div>
          <div>
            <dt>Comisión ({pct}%)</dt>
            <dd className="tnum">{pesos(comision)}</dd>
          </div>
          <div className="calc-queda" data-negativo={queda < 0 || undefined}>
            <dt>{queda < 0 ? "Te falta para cubrir el evento" : "Te queda, después de costos"}</dt>
            <dd className="tnum">{pesos(Math.abs(queda))}</dd>
          </div>
        </dl>

        <div className="calc-barra" aria-hidden="true">
          <span className="calc-b-costos" style={{ width: ancho(costos) }} />
          <span className="calc-b-comision" style={{ width: ancho(comision) }} />
          <span className="calc-b-queda" style={{ width: ancho(Math.max(queda, 0)) }} />
        </div>
        <div className="calc-ref" aria-hidden="true">
          <span><i className="calc-b-costos" /> Costos</span>
          <span><i className="calc-b-comision" /> Comisión</span>
          <span><i className="calc-b-queda" /> Te queda</span>
        </div>

        <p className="calc-equilibrio">
          Para cubrir el evento tenés que vender{" "}
          <b className="tnum">{equilibrio.toLocaleString("es-AR")} fotos</b>.
          {fotos > 0 && equilibrio > 0 && (
            <> Con estos números vendés {fotos >= equilibrio ? "más" : "menos"}.</>
          )}
        </p>
        <p className="calc-aviso">Los valores iniciales son de ejemplo, no una recomendación de precio.</p>
      </div>
    </div>
  );
}
