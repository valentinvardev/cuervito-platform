"use client";

import { useActionState, useEffect, useState } from "react";

import { setQuotasAction, type QuotaState } from "../actions";
import { formatBytes, type QuotaUsage } from "~/server/quotas";

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

  // Pre-fill: GB if override set, empty if default
  const storageGBPrefill = currentStorageBytes
    ? (Number(currentStorageBytes) / (1024 * 1024 * 1024)).toString()
    : "";
  const recPrefill = currentRecognitionMonthly?.toString() ?? "";

  const [savedToast, setSavedToast] = useState(false);
  useEffect(() => {
    if (state.saved) {
      setSavedToast(true);
      const t = setTimeout(() => setSavedToast(false), 2500);
      return () => clearTimeout(t);
    }
  }, [state.saved]);

  return (
    <form
      action={action}
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 14,
        padding: 22,
      }}
    >
      <input type="hidden" name="userId" value={userId} />

      <div className="form-grid" style={{ marginBottom: 16 }}>
        <div className="field">
          <label className="label">Storage (GB)</label>
          <input
            type="number"
            name="storageGB"
            min={0}
            max={100000}
            step="1"
            placeholder="100 (default)"
            defaultValue={storageGBPrefill}
            className="input"
          />
          <div className="field-hint">
            {usage ? (
              <>
                Actual: {formatBytes(usage.storage.usedBytes)} usado de{" "}
                {formatBytes(usage.storage.limitBytes)} ({usage.storage.pct}%)
                {usage.storage.overrideActive ? " · override activo" : " · usando default del sistema"}
              </>
            ) : (
              <>Vacío = usar default del sistema.</>
            )}
          </div>
        </div>

        <div className="field">
          <label className="label">Reconocimientos / mes</label>
          <input
            type="number"
            name="recognitionMonthly"
            min={0}
            max={10000000}
            step="1000"
            placeholder="10000 (default)"
            defaultValue={recPrefill}
            className="input"
          />
          <div className="field-hint">
            {usage ? (
              <>
                Este mes: {usage.recognitions.used.toLocaleString("es-AR")} de{" "}
                {usage.recognitions.limit.toLocaleString("es-AR")} ({usage.recognitions.pct}%)
                {usage.recognitions.overrideActive ? " · override activo" : " · usando default del sistema"}
              </>
            ) : (
              <>Vacío = usar default del sistema.</>
            )}
          </div>
        </div>
      </div>

      {state.error && (
        <div
          className="field-error"
          style={{
            marginBottom: 14,
            padding: "10px 14px",
            border: "1px solid rgba(224,85,85,0.4)",
            borderRadius: 8,
          }}
        >
          <i className="ti ti-alert-circle" />
          {state.error}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "flex-end" }}>
        {savedToast && (
          <span style={{ color: "var(--success)", fontSize: 13, marginRight: "auto" }}>
            <i className="ti ti-circle-check-filled" /> Guardado
          </span>
        )}
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Guardando…" : "Guardar overrides"}
        </button>
      </div>
    </form>
  );
}
