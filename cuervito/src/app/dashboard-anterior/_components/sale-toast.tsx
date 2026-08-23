"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SaleEventDetail = { amount?: string; detail?: string };

declare global {
  interface Window {
    cuervitoNotifySale?: (opts?: SaleEventDetail) => void;
  }
}

const COIN_DROP_NOTES = [
  { f: 659.25, t: 0.0 }, // E5
  { f: 783.99, t: 0.14 }, // G5
  { f: 1046.5, t: 0.28 }, // C6
];

export function SaleToast() {
  const [show, setShow] = useState(false);
  const [amount, setAmount] = useState("$2.400");
  const [detail, setDetail] = useState("1 foto · Maratón BA");
  const [coinKey, setCoinKey] = useState(0); // bump to replay coin animation
  const audioRef = useRef<AudioContext | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const playSound = useCallback(() => {
    try {
      if (!audioRef.current) {
        const Ctor =
          window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioRef.current = new Ctor();
      }
      const ctx = audioRef.current;
      if (ctx.state === "suspended") void ctx.resume();
      const now = ctx.currentTime;
      for (const { f, t } of COIN_DROP_NOTES) {
        const start = now + t;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(f, start);
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.14, start + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
        osc.connect(gain).connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.2);
      }
    } catch {
      // audio not available
    }
  }, []);

  const showSale = useCallback(
    (opts?: SaleEventDetail) => {
      if (opts?.amount) setAmount(opts.amount);
      if (opts?.detail) setDetail(opts.detail);
      setCoinKey((k) => k + 1);
      setShow(true);
      playSound();
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setShow(false), 5500);
    },
    [playSound],
  );

  useEffect(() => {
    window.cuervitoNotifySale = showSale;
    return () => {
      delete window.cuervitoNotifySale;
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [showSale]);

  return (
    <div className={`adm-sale-toast ${show ? "show" : ""}`}>
      <button
        className="adm-sale-close"
        aria-label="Cerrar"
        onClick={() => setShow(false)}
      >
        <i className="ti ti-x" />
      </button>
      <div className="adm-coin-stack" aria-hidden="true" key={coinKey}>
        <div className="adm-coin">$</div>
        <div className="adm-coin">$</div>
        <div className="adm-coin">$</div>
      </div>
      <div className="adm-sale-body">
        <div className="label">Venta nueva</div>
        <div className="ttl">
          <span className="amt">{amount}</span>
        </div>
        <div className="sub">{detail}</div>
      </div>
    </div>
  );
}
