"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { fireConfetti } from "~/lib/confetti";

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
  // Three-stage UI:
  //   pending   → ring spins, "Estamos confirmando tu compra"
  //   approved  → ring closes, check appears, "¡Listo! Pago aprobado"
  //   delivered → confetti + "Gracias por tu compra", auto-nav to /descarga
  type Stage = "pending" | "approved" | "delivered";
  const [stage, setStage] = useState<Stage>(
    initialStatus === "PAID" ? "approved" : "pending",
  );
  // Smooth-swap copy when state changes (prototype-style)
  const [swap, setSwap] = useState(false);
  const swapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confettiRef = useRef<HTMLDivElement>(null);

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

  // Three-step transition once we reach PAID:
  //   t=0       → stage=approved, ring closes + check pops in (CSS does this)
  //   t≈1.8s    → stage=delivered, swap copy to "Gracias por tu compra" + confetti
  //   t≈4.6s    → router.push(/descarga)
  useEffect(() => {
    if (status !== "PAID") return;
    if (!downloadToken) return;
    if (stage === "delivered") return; // already running the timeline

    // Step 1: trigger the "approved" stage (ring close + check)
    setSwap(true);
    swapTimer.current = setTimeout(() => setSwap(false), 280);
    setStage("approved");

    // Step 2: after the ring has filled, swap to "delivered" + fire confetti
    const tDelivered = setTimeout(() => {
      setSwap(true);
      setTimeout(() => {
        setStage("delivered");
        setSwap(false);
        if (confettiRef.current) fireConfetti(confettiRef.current);
      }, 280);
    }, 1800);

    // Step 3: navigate to /descarga once the celebration has played
    const tNav = setTimeout(() => {
      router.push(`/descarga/${downloadToken}`);
    }, 4600);

    return () => {
      clearTimeout(tDelivered);
      clearTimeout(tNav);
      if (swapTimer.current) clearTimeout(swapTimer.current);
    };
  }, [status, downloadToken, router, stage]);

  const titleHtml =
    stage === "delivered"
      ? "Gracias por<br />tu compra."
      : stage === "approved"
        ? "¡Listo! Pago<br />aprobado."
        : "Estamos confirmando<br />tu compra.";

  const ledeHtml =
    stage === "delivered" ? (
      <>
        Te llevamos a tus{" "}
        <strong>
          {photoCount.toLocaleString("es-AR")}{" "}
          {photoCount === 1 ? "foto" : "fotos"}
        </strong>
        …
      </>
    ) : stage === "approved" ? (
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

  const footHtml =
    stage === "delivered" ? (
      <>
        También te enviamos el link a{" "}
        <strong style={{ color: "var(--text-primary)" }}>{buyerEmail}</strong>.
      </>
    ) : stage === "approved" ? (
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
    <main className="pago-wrap" data-state={stage}>
      <div className="confetti-container" ref={confettiRef} aria-hidden="true" />

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

      {stage !== "delivered" && (
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
      )}

      <p className={`pago-foot ${swap ? "swap-out" : ""}`}>{footHtml}</p>
    </main>
  );
}
