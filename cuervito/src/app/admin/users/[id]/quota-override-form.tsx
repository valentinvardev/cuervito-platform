"use client";

import { RotateCcw } from "lucide-react";
import { useActionState, useEffect, useState } from "react";

import { setQuotasAction, type QuotaState } from "../actions";
import { formatBytes, type QuotaUsage } from "~/lib/quotas-shared";

/**
 * Las cuotas de la cuenta: almacenamiento y reconocimientos por mes.
 *
 * Vacío es "el valor de todos". Un número es una excepción para esta cuenta,
 * y se muestra como tal, con la píldora, para que se vea de reojo quién tiene
 * algo distinto al resto.
 */
export function QuotaOverrideForm({
  userId,
  currentStorageBytes,
  currentRecognitionMonthly,
  usage,
}: {
  userId: string;
  currentStorageBytes: string | null;
  currentRecognitionMonthly: number | null;
  usage: QuotaUsage | null;
}) {
  const [state, action, pending] = useActionState<QuotaState, FormData>(setQuotasAction, {
    error: null,
  });

  const gbInicial = currentStorageBytes
    ? (Number(currentStorageBytes) / (1024 * 1024 * 1024)).toString()
    : "";
  const [gb, setGb] = useState(gbInicial);
  const [rec, setRec] = useState(currentRecognitionMonthly?.toString() ?? "");

  const [guardado, setGuardado] = useState(false);
  useEffect(() => {
    if (state.saved) {
      setGuardado(true);
      const t = setTimeout(() => setGuardado(false), 2500);
      return () => clearTimeout(t);
    }
  }, [state.saved]);

  return (
    <form action={action} className="card">
      <input type="hidden" name="userId" value={userId} />
      <div className="card-h">
        <div>
          <h2>Cuotas</h2>
          <div className="sub">Vacío es el valor de todos; un número es una excepción para esta cuenta.</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--s-3)" }}>
          {guardado && <span style={{ fontSize: 12.5, color: "var(--ok-txt)" }}>Guardado</span>}
          {state.error && <span style={{ fontSize: 12.5, color: "var(--bad-txt)" }}>{state.error}</span>}
          <button type="submit" className="btn btn-pri btn-sm" disabled={pending}>
            {pending ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>

      <div className="cuotas">
        <Cuota
          nombre="Almacenamiento"
          unidad="GB"
          inputName="storageGB"
          valor={gb}
          alCambiar={setGb}
          porDefecto="100"
          usado={usage ? formatBytes(usage.storage.usedBytes) : "—"}
          limite={usage ? formatBytes(usage.storage.limitBytes) : "—"}
          pct={usage?.storage.pct ?? 0}
          excepcion={usage?.storage.overrideActive ?? false}
        />
        <Cuota
          nombre="Reconocimientos por mes"
          unidad="llamadas"
          inputName="recognitionMonthly"
          valor={rec}
          alCambiar={setRec}
          porDefecto="10000"
          usado={usage ? usage.recognitions.used.toLocaleString("es-AR") : "—"}
          limite={usage ? usage.recognitions.limit.toLocaleString("es-AR") : "—"}
          pct={usage?.recognitions.pct ?? 0}
          excepcion={usage?.recognitions.overrideActive ?? false}
        />
      </div>
    </form>
  );
}

function Cuota({
  nombre,
  unidad,
  inputName,
  valor,
  alCambiar,
  porDefecto,
  usado,
  limite,
  pct,
  excepcion,
}: {
  nombre: string;
  unidad: string;
  inputName: string;
  valor: string;
  alCambiar: (v: string) => void;
  porDefecto: string;
  usado: string;
  limite: string;
  pct: number;
  excepcion: boolean;
}) {
  const p = Math.max(0, Math.min(100, pct));
  return (
    <div className="cuota">
      <div className="cuota-h">
        <b>
          {nombre}
          {excepcion && (
            <span className="pill draft" style={{ marginLeft: 8, verticalAlign: 1 }}>
              <i /> excepción
            </span>
          )}
        </b>
        <span className="tnum">
          <b style={{ fontWeight: 500, color: "var(--ink)" }}>{usado}</b> de {limite}{" "}
          <span style={{ color: p >= 90 ? "var(--bad-txt)" : "var(--ink-3)" }}>({p} %)</span>
        </span>
      </div>
      <div className="barra-p">
        <i style={{ width: `${p}%`, background: p >= 90 ? "var(--bad)" : undefined }} />
      </div>
      <div className="cuota-in">
        <input
          type="number"
          name={inputName}
          min={0}
          step="1"
          placeholder={`${porDefecto} (el de todos)`}
          value={valor}
          onChange={(e) => alCambiar(e.target.value)}
          className="inp"
          aria-label={`${nombre}, en ${unidad}`}
        />
        <span>{unidad}</span>
        {valor && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => alCambiar("")}
            data-tip="Volver al valor de todos"
          >
            <RotateCcw /> Quitar
          </button>
        )}
      </div>
    </div>
  );
}
