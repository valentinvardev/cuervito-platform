"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function CobrosClient({
  email,
  mpUserId,
  mpConnectedAt,
  mpLiveMode,
  mpConfigured,
  platformFeePercent,
  successFlag,
  errorParam,
}: {
  email: string;
  mpUserId: string | null;
  mpConnectedAt: string | null;
  mpLiveMode: boolean;
  mpConfigured: boolean;
  platformFeePercent: number;
  successFlag: boolean;
  errorParam: string | null;
}) {
  const router = useRouter();
  const isConnected = !!mpUserId;
  const [savedToast, setSavedToast] = useState<string | null>(
    successFlag ? "Mercado Pago conectado" : null,
  );
  const [error, setError] = useState<string | null>(
    errorParam ? errorLabel(errorParam) : null,
  );
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    if (!savedToast) return;
    const t = setTimeout(() => setSavedToast(null), 2500);
    return () => clearTimeout(t);
  }, [savedToast]);

  async function disconnect() {
    if (!confirm("¿Desconectar Mercado Pago? No vas a poder recibir ventas hasta volver a conectarlo.")) return;
    setDisconnecting(true);
    const res = await fetch("/api/mp/oauth/disconnect", { method: "POST" });
    setDisconnecting(false);
    if (!res.ok) {
      setError("No pudimos desconectar.");
      return;
    }
    router.refresh();
  }

  return (
    <main className="wrap-narrower">
      {savedToast && (
        <div
          style={{
            position: "fixed",
            top: 84,
            right: 20,
            zIndex: 60,
            padding: "10px 14px",
            background: "var(--bg-surface)",
            border: "1px solid var(--success)",
            borderRadius: 10,
            color: "var(--success)",
            fontSize: 14,
            boxShadow: "0 12px 30px rgba(0,0,0,0.4)",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <i className="ti ti-circle-check-filled" />
          {savedToast}
        </div>
      )}

      <div className="head">
        <h1>Método de pago</h1>
        <div className="sub">Acá administrás cómo recibís tus ventas.</div>
      </div>

      {error && (
        <div
          style={{
            marginBottom: 16,
            padding: "10px 14px",
            background: "rgba(224,85,85,0.08)",
            border: "1px solid rgba(224,85,85,0.4)",
            borderRadius: 10,
            color: "var(--error)",
            fontSize: 13.5,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <i className="ti ti-alert-circle" />
          {error}
        </div>
      )}

      {!mpConfigured && (
        <div
          style={{
            padding: 16,
            background: "rgba(245,130,10,0.08)",
            border: "1px solid var(--border-accent)",
            borderRadius: 12,
            marginBottom: 18,
            fontSize: 13.5,
          }}
        >
          <strong>Mercado Pago no está configurado.</strong> Falta agregar
          <code> MP_CLIENT_ID</code> y <code>MP_CLIENT_SECRET</code> en el servidor.
        </div>
      )}

      {/* MP card */}
      <div className="mp-card">
        <div className="mp-row">
          <div className="mp-logo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/mp/mp-pluma-vertical.svg" alt="Mercado Pago" />
          </div>
          <div className="mp-info">
            <div className="ttl">Mercado Pago</div>
            {isConnected ? (
              <div className="status">
                <i className="ti ti-circle-check-filled" />
                Conectada{mpLiveMode ? " · modo producción" : " · modo prueba"}
              </div>
            ) : (
              <div
                className="status"
                style={{ color: "var(--text-secondary)", fontWeight: 400 }}
              >
                Vinculá tu cuenta para empezar a recibir pagos.
              </div>
            )}
          </div>
        </div>

        {isConnected ? (
          <>
            <div className="mp-details">
              <Field label="Cuenta" value={email || "—"} />
              <Field
                label="Vinculada el"
                value={
                  mpConnectedAt
                    ? new Date(mpConnectedAt).toLocaleDateString("es-AR", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })
                    : "—"
                }
              />
              <Field label="Comisión Cuervito" value={`${platformFeePercent}%`} />
              <Field label="Acreditación" value="Instantánea" />
            </div>

            <div className="mp-actions">
              <button
                type="button"
                className="btn btn-danger"
                onClick={disconnect}
                disabled={disconnecting}
              >
                <i className="ti ti-plug-off" />
                {disconnecting ? "Desconectando…" : "Desconectar"}
              </button>
              <a href="/api/mp/oauth/start" className="btn btn-outline">
                <i className="ti ti-refresh" />
                Volver a vincular
              </a>
            </div>
          </>
        ) : (
          <>
            <ul className="mp-bullets">
              <li>
                <i className="ti ti-check" />
                Comisión Cuervito: <strong>{platformFeePercent}% por venta</strong>
              </li>
              <li>
                <i className="ti ti-check" />
                Acreditación instantánea en tu cuenta MP
              </li>
              <li>
                <i className="ti ti-check" />
                Usás tu cuenta MP personal — sin formularios
              </li>
            </ul>

            <a
              href="/api/mp/oauth/start"
              className="btn btn-primary mp-connect-btn"
            >
              <i className="ti ti-plug-connected" />
              Conectar Mercado Pago
            </a>

            <div className="mp-help">
              ¿Todavía no tenés cuenta?{" "}
              <a href="https://www.mercadopago.com.ar" target="_blank" rel="noopener">
                Creá una gratis →
              </a>
            </div>
          </>
        )}
      </div>

      {/* Info notes */}
      <div className="info-note" style={{ marginBottom: 12 }}>
        <span className="ic">
          <i className="ti ti-info-circle" />
        </span>
        <div>
          <strong>Cómo funciona:</strong> cada venta se acredita directo en tu cuenta de
          Mercado Pago. Cuervito retiene automáticamente el {platformFeePercent}% de
          comisión y vos recibís el {100 - platformFeePercent}% restante sin necesidad de
          retirar nada manualmente.
        </div>
      </div>

      <div className="info-note">
        <span className="ic security">
          <i className="ti ti-shield-lock" />
        </span>
        <div>
          <strong>Retención de seguridad:</strong> Mercado Pago retiene los fondos por
          unos días después de cada venta como medida estándar de protección contra
          fraude y contracargos. Tus fondos están <strong>asegurados al 100%</strong> y
          se liberan automáticamente al finalizar la retención.
        </div>
      </div>
    </main>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="field">
      <div className="lbl">{label}</div>
      <div className="val">{value}</div>
    </div>
  );
}

function errorLabel(err: string): string {
  switch (err) {
    case "missing_code":
      return "El proceso de conexión no se completó. Probá de nuevo.";
    case "state_mismatch":
      return "La sesión cambió durante la conexión. Probá de nuevo.";
    case "oauth_failed":
      return "Mercado Pago rechazó la conexión. Intentá nuevamente.";
    default:
      return `Error: ${err}`;
  }
}
