"use client";

import { useActionState, useEffect, useState } from "react";

import { setQuotasAction, type QuotaState } from "../actions";
import { formatBytes, type QuotaUsage } from "~/lib/quotas-shared";

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

  const storageGBPrefill = currentStorageBytes
    ? (Number(currentStorageBytes) / (1024 * 1024 * 1024)).toString()
    : "";
  const recPrefill = currentRecognitionMonthly?.toString() ?? "";

  const [storageVal, setStorageVal] = useState(storageGBPrefill);
  const [recVal, setRecVal] = useState(recPrefill);

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
        display: "grid",
        gap: 18,
      }}
    >
      <input type="hidden" name="userId" value={userId} />

      <QuotaRow
        icon="ti-database"
        label="Almacenamiento"
        unitLabel="GB"
        inputName="storageGB"
        value={storageVal}
        onChange={setStorageVal}
        defaultPlaceholder="100"
        usedText={usage ? formatBytes(usage.storage.usedBytes) : "—"}
        limitText={usage ? formatBytes(usage.storage.limitBytes) : "—"}
        pct={usage?.storage.pct ?? 0}
        overrideActive={usage?.storage.overrideActive ?? false}
      />

      <QuotaRow
        icon="ti-scan-eye"
        label="Reconocimientos / mes"
        unitLabel="calls"
        inputName="recognitionMonthly"
        value={recVal}
        onChange={setRecVal}
        defaultPlaceholder="10000"
        usedText={usage ? usage.recognitions.used.toLocaleString("es-AR") : "—"}
        limitText={usage ? usage.recognitions.limit.toLocaleString("es-AR") : "—"}
        pct={usage?.recognitions.pct ?? 0}
        overrideActive={usage?.recognitions.overrideActive ?? false}
      />

      {state.error && (
        <div
          className="field-error"
          style={{
            padding: "10px 14px",
            border: "1px solid rgba(224,85,85,0.4)",
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 13,
            color: "var(--error)",
          }}
        >
          <i className="ti ti-alert-circle" />
          {state.error}
        </div>
      )}

      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          justifyContent: "flex-end",
          paddingTop: 4,
          borderTop: "1px solid var(--border-subtle)",
          marginTop: 4,
          paddingBlockStart: 14,
        }}
      >
        {savedToast && (
          <span
            style={{
              color: "var(--success)",
              fontSize: 13,
              marginRight: "auto",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
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

function QuotaRow({
  icon,
  label,
  unitLabel,
  inputName,
  value,
  onChange,
  defaultPlaceholder,
  usedText,
  limitText,
  pct,
  overrideActive,
}: {
  icon: string;
  label: string;
  unitLabel: string;
  inputName: string;
  value: string;
  onChange: (v: string) => void;
  defaultPlaceholder: string;
  usedText: string;
  limitText: string;
  pct: number;
  overrideActive: boolean;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  const color =
    clamped >= 90 ? "var(--error)" : clamped >= 70 ? "var(--warning)" : "var(--accent)";

  return (
    <div
      style={{
        background: "var(--bg-base)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 12,
        padding: "16px 18px",
        display: "grid",
        gap: 12,
      }}
    >
      {/* Header: icon + label + usage */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "inline-flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <span
            style={{
              width: 32,
              height: 32,
              borderRadius: 9,
              background: "var(--accent-deep)",
              border: "1px solid var(--border-accent)",
              color: "var(--accent)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
              flexShrink: 0,
            }}
          >
            <i className={`ti ${icon}`} />
          </span>
          <span style={{ fontWeight: 500, fontSize: 14, color: "var(--text-primary)" }}>
            {label}
          </span>
          <Badge active={overrideActive} />
        </div>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12.5,
            color: "var(--text-tertiary)",
          }}
        >
          <span style={{ color: "var(--text-primary)" }}>{usedText}</span> / {limitText}{" "}
          <span style={{ color }}>({clamped}%)</span>
        </span>
      </div>

      {/* Progress bar */}
      <div
        style={{
          height: 6,
          background: "var(--bg-elevated)",
          borderRadius: 999,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${clamped}%`,
            background: color,
            borderRadius: 999,
            transition: "width 240ms ease",
          }}
        />
      </div>

      {/* Override input */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <label
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10.5,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--text-tertiary)",
            flexShrink: 0,
          }}
        >
          Override
        </label>
        <input
          type="number"
          name={inputName}
          min={0}
          step="1"
          placeholder={`${defaultPlaceholder} (default)`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input"
          style={{ flex: 1, minWidth: 140 }}
        />
        <span style={{ fontSize: 12, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>
          {unitLabel}
        </span>
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="btn btn-ghost"
            style={{ height: 32, padding: "0 10px", fontSize: 12 }}
            title="Volver al default del sistema"
          >
            <i className="ti ti-rotate-clockwise" /> Reset
          </button>
        )}
      </div>
    </div>
  );
}

function Badge({ active }: { active: boolean }) {
  return (
    <span
      className="status-pill"
      style={{
        fontSize: 10,
        padding: "2px 7px",
        color: active ? "var(--accent)" : "var(--text-tertiary)",
        borderColor: active ? "var(--border-accent)" : undefined,
        background: active ? "var(--accent-deep)" : undefined,
      }}
    >
      {active ? "Override" : "Default"}
    </span>
  );
}
