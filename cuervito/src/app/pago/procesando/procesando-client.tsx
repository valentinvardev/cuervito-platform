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
  // Always start at "pending" so the user sees the animation, even when the
  // sale is already PAID (e.g. test mode). The timeline below moves through
  // approved → delivered → /descarga.
  const [stage, setStage] = useState<Stage>("pending");
  // Smooth-swap copy when state changes (prototype-style)
  const [swap, setSwap] = useState(false);
  const confettiRef = useRef<HTMLDivElement>(null);
  // Guarantees the celebration timeline only fires once, no matter how many
  // times the polling or the state changes.
  const timelineStarted = useRef(false);

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

  // Celebration timeline — runs ONCE when the sale becomes PAID:
  //
  //   pending  ring spins. We extend this beat so the buyer registers it.
  //     ↓ +1800ms  copy crossfade out
  //   approved  ring closes + check pops, copy → "¡Listo! Pago aprobado"
  //     ↓ +2200ms copy crossfade out
  //   delivered copy → "Gracias por tu compra" + confetti
  //     ↓ +3000ms (long beat so /descarga prefetch lands and there's no
  //                loading wheel on the next route)
  //   router.replace(/descarga) — replace so the back button skips us
  //
  // The ref guard makes this idempotent regardless of how many polls land.
  useEffect(() => {
    if (status !== "PAID" || !downloadToken) return;
    if (timelineStarted.current) return;
    timelineStarted.current = true;

    // Warm up /descarga as soon as we know the token, so when we navigate
    // it's already cached and there's no flash of the loading skeleton.
    router.prefetch(`/descarga/${downloadToken}`);

    const timers: ReturnType<typeof setTimeout>[] = [];
    const fadeOut = () => setSwap(true);
    const fadeIn = () => setSwap(false);

    // pending → approved (longer hold on "Confirmando pago")
    timers.push(setTimeout(fadeOut, 1700));
    timers.push(
      setTimeout(() => {
        setStage("approved");
        fadeIn();
      }, 1980),
    );

    // approved → delivered (give the ring time to fully close + check pop)
    timers.push(setTimeout(fadeOut, 4100));
    timers.push(
      setTimeout(() => {
        setStage("delivered");
        fadeIn();
        if (confettiRef.current) fireConfetti(confettiRef.current);
      }, 4380),
    );

    // delivered → /descarga (long beat so the confetti is enjoyed, prefetch
    // is in-flight, and the next route mounts without a loading wheel).
    timers.push(
      setTimeout(() => {
        router.replace(`/descarga/${downloadToken}`);
      }, 7400),
    );

    return () => {
      for (const t of timers) clearTimeout(t);
    };
  }, [status, downloadToken, router]);

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
