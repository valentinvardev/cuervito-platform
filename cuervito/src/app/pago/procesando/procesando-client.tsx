"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type SaleStatus =
  | "PENDING"
  | "PAID"
  | "FAILED"
  | "REFUNDED"
  | "EXPIRED";

function formatARS(cents: number): string {
  return `$${(cents / 100).toLocaleString("es-AR")}`;
}

export function ProcesandoClient({
  saleId,
  initialStatus,
  initialDownloadToken,
  buyerName,
  buyerEmail,
  photoCount,
  totalCents,
  eventName,
}: {
  saleId: string;
  initialStatus: SaleStatus;
  initialDownloadToken: string | null;
  buyerName: string;
  buyerEmail: string;
  photoCount: number;
  totalCents: number;
  eventName: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<SaleStatus>(initialStatus);
  const [downloadToken, setDownloadToken] = useState<string | null>(
    initialDownloadToken,
  );
  // The "approved" CSS state — flipped slightly *after* status becomes PAID so
  // the user has time to register the change before the redirect.
  const [showApproved, setShowApproved] = useState(initialStatus === "PAID");
  // Smooth-swap copy when state changes (prototype-style)
  const [swap, setSwap] = useState(false);
  const swapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Polling loop — bail when we land on PAID.
  useEffect(() => {
    if (status === "PAID") return;

    let cancelled = false;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/sales/${saleId}/status`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          status: SaleStatus;
          downloadToken: string | null;
        };
        if (cancelled) return;
        if (data.status !== status) {
          setStatus(data.status);
          if (data.downloadToken) setDownloadToken(data.downloadToken);
        }
      } catch {
        // network blip — keep polling
      }
    }, 1100);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [saleId, status]);

  // When we transition into PAID: swap copy, then fire approved CSS, then nav
  useEffect(() => {
    if (status !== "PAID") return;
    if (!downloadToken) return; // wait until token is in state

    // Fade copy out, then back in with new text (matches prototype timing)
    setSwap(true);
    swapTimer.current = setTimeout(() => setSwap(false), 280);

    // Slight beat so the user sees the ring fill before the page changes
    setShowApproved(true);

    const navTimer = setTimeout(() => {
      router.push(`/descarga/${downloadToken}`);
    }, 2200);

    return () => {
      clearTimeout(navTimer);
      if (swapTimer.current) clearTimeout(swapTimer.current);
    };
  }, [status, downloadToken, router]);

  const titleHtml = showApproved
    ? "¡Listo! Pago<br />aprobado."
    : "Estamos confirmando<br />tu compra.";

  const ledeHtml = showApproved ? (
    <>
      Estamos preparando tus{" "}
      <strong>
        {photoCount.toLocaleString("es-AR")}{" "}
        {photoCount === 1 ? "foto" : "fotos"}
      </strong>
      . En segundos te llevamos a la descarga.
    </>
  ) : (
    <>
      Apenas Mercado Pago aprueba el pago, te enviamos las fotos a{" "}
      <strong>{buyerEmail}</strong>. Esto suele tardar entre 5 y 30 segundos.
    </>
  );

  const footHtml = showApproved ? (
    <>
      También te enviamos el link a{" "}
      <strong style={{ color: "var(--text-primary)" }}>{buyerEmail}</strong>.
    </>
  ) : (
    <>
      Podés cerrar esta página — te avisamos por mail.
      <br />
      ¿Algo no anda?{" "}
      <a href="mailto:hola@cuervito.app">Escribinos</a>.
    </>
  );

  return (
    <main className="pago-wrap" data-state={showApproved ? "approved" : "pending"}>
      <div className="pago-ring">
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <circle className="track" cx="60" cy="60" r="54" />
          <circle className="indeterminate" cx="60" cy="60" r="54" />
        </svg>
        <div className="check">
          <i className="ti ti-circle-check-filled" />
        </div>
      </div>

      <h1
        className={`pago-title ${swap ? "swap-out" : ""}`}
        dangerouslySetInnerHTML={{ __html: titleHtml }}
      />
      <p className={`pago-lede ${swap ? "swap-out" : ""}`}>{ledeHtml}</p>

      <div className="pago-summary">
        <div className="row">
          <span>Comprador</span>
          <span>{buyerName}</span>
        </div>
        <div className="row">
          <span>Email</span>
          <span>{buyerEmail}</span>
        </div>
        <div className="row">
          <span>Fotos</span>
          <strong>{photoCount.toLocaleString("es-AR")}</strong>
        </div>
        <div className="row total">
          <span>Total pagado</span>
          <span className="amt">{formatARS(totalCents)}</span>
        </div>
      </div>

      <p className={`pago-foot ${swap ? "swap-out" : ""}`}>{footHtml}</p>
    </main>
  );
}
