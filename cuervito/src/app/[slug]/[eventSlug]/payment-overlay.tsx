"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export type PaymentOverlayState = "processing" | "approved";

export function PaymentProcessingOverlay({
  state,
  testMode = false,
}: {
  state: PaymentOverlayState;
  testMode?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <div className={`pay-overlay ${state}`} role="status" aria-live="polite">
      <div className="pay-card">
        {state === "processing" ? (
          <>
            <div className="pay-spinner" aria-hidden="true">
              <span className="ring" />
              <i className="ti ti-credit-card" />
            </div>
            <div className="pay-ttl">
              {testMode ? "Confirmando tu compra…" : "Procesando tu pago…"}
            </div>
            <div className="pay-sub">
              {testMode
                ? "Modo test · sin cargo real"
                : "No cierres ni recargues esta página."}
            </div>
          </>
        ) : (
          <>
            <div className="pay-check" aria-hidden="true">
              <i className="ti ti-check" />
            </div>
            <div className="pay-ttl pay-ttl-ok">¡Pago aprobado!</div>
            <div className="pay-sub">Preparando tus fotos…</div>
          </>
        )}
      </div>
    </div>,
    document.documentElement,
  );
}
