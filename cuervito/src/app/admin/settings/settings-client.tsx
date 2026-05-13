"use client";

import { useState, useTransition } from "react";

import { toggleMpTestModeAction } from "./actions";

export function SettingsClient({ mpTestMode }: { mpTestMode: boolean }) {
  const [enabled, setEnabled] = useState(mpTestMode);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    const next = !enabled;
    setEnabled(next); // optimistic
    setError(null);
    startTransition(async () => {
      try {
        await toggleMpTestModeAction(next);
      } catch (err) {
        setEnabled(!next); // revert
        setError(err instanceof Error ? err.message : "Error al guardar.");
      }
    });
  }

  return (
    <main className="wrap-narrower">
      <div className="head">
        <h1>Settings</h1>
        <div className="sub">Configuración global de la plataforma.</div>
      </div>

      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 14,
          padding: 24,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 18,
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: 1, minWidth: 240 }}>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: 17,
                letterSpacing: "-0.02em",
                marginBottom: 6,
              }}
            >
              Mercado Pago · Modo test
            </div>
            <div
              style={{
                fontSize: 13.5,
                color: "var(--text-secondary)",
                lineHeight: 1.55,
              }}
            >
              Cuando está <strong style={{ color: "var(--warning)" }}>activado</strong>, las
              compras saltean la pasarela de Mercado Pago y crean la venta como pagada
              directamente. Útil para probar el flujo de descarga sin cobros reales.
              <br />
              <br />
              Cuando está <strong style={{ color: "var(--success)" }}>desactivado</strong>,
              las compras pasan por MP normalmente y se cobra de verdad.
            </div>
          </div>

          <button
            type="button"
            onClick={toggle}
            disabled={pending}
            aria-pressed={enabled}
            className={`toggle-switch ${enabled ? "on" : ""}`}
          >
            <span className="thumb" />
          </button>
        </div>

        <div
          style={{
            marginTop: 18,
            paddingTop: 16,
            borderTop: "1px solid var(--border-subtle)",
            fontSize: 13,
            color: enabled ? "var(--warning)" : "var(--success)",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <i
            className={`ti ${enabled ? "ti-flask" : "ti-circle-check-filled"}`}
            style={{ fontSize: 16 }}
          />
          {enabled ? (
            <span>
              Modo test <strong>ON</strong> · no se va a cobrar nada
            </span>
          ) : (
            <span>
              Modo producción <strong>ON</strong> · las compras se cobran de verdad
            </span>
          )}
          {pending && (
            <span style={{ color: "var(--text-tertiary)", marginLeft: 8 }}>· guardando…</span>
          )}
        </div>

        {error && (
          <div
            style={{
              marginTop: 12,
              padding: "8px 12px",
              fontSize: 12.5,
              color: "var(--error)",
              background: "rgba(224,85,85,0.08)",
              border: "1px solid rgba(224,85,85,0.4)",
              borderRadius: 8,
            }}
          >
            <i className="ti ti-alert-circle" /> {error}
          </div>
        )}
      </div>
    </main>
  );
}
