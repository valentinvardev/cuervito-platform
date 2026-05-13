"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Range = "7d" | "30d" | "90d" | "1y";

const TS: Record<
  Range,
  { label: string; trigger: string; amount: number; photos: number; delta: number; points: number[] }
> = {
  "7d": {
    label: "Últimos 7 días",
    trigger: "7 días",
    amount: 0,
    photos: 0,
    delta: 0,
    points: [4, 5, 4, 6, 5, 7, 8],
  },
  "30d": {
    label: "Últimos 30 días",
    trigger: "30 días",
    amount: 0,
    photos: 0,
    delta: 0,
    points: [
      5, 6, 5, 7, 6, 8, 7, 9, 8, 9, 7, 10, 9, 11, 10, 12, 11, 12, 11, 13, 12, 14, 13, 15, 14, 16, 15,
      17, 16, 18,
    ],
  },
  "90d": { label: "Últimos 90 días", trigger: "90 días", amount: 0, photos: 0, delta: 0, points: Array.from({ length: 90 }, (_, i) => 5 + (i / 90) * 30 + Math.sin(i / 4) * 4) },
  "1y": { label: "Último año", trigger: "1 año", amount: 0, photos: 0, delta: 0, points: Array.from({ length: 50 }, (_, i) => 8 + i * 1.2 + Math.sin(i / 3) * 5) },
};

function fmt(n: number) {
  return n.toLocaleString("es-AR");
}

function buildSpark(points: number[], w = 160, h = 44) {
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  const padX = 2;
  const padTop = 4;
  const padBot = 4;
  const usableW = w - padX * 2;
  const usableH = h - padTop - padBot;
  const step = usableW / (points.length - 1);
  let line = "";
  points.forEach((p, i) => {
    const x = padX + i * step;
    const y = padTop + (1 - (p - min) / range) * usableH;
    line += (i === 0 ? "M" : "L") + " " + x.toFixed(1) + " " + y.toFixed(1) + " ";
  });
  const lastX = padX + (points.length - 1) * step;
  const lastY =
    padTop +
    (1 - ((points[points.length - 1] ?? 0) - min) / range) * usableH;
  const baseY = padTop + usableH;
  const area = line + ` L ${lastX} ${baseY} L ${padX} ${baseY} Z`;
  return { line, area, lastX, lastY };
}

export function SalesMini() {
  const [range, setRange] = useState<Range>("30d");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const data = TS[range];
  const spark = useMemo(() => buildSpark(data.points), [data.points]);

  return (
    <section className="sales-mini" aria-label="Resumen de ventas">
      <div className="sm-totals">
        <span className="label">{data.label}</span>
        <div className="amount-row">
          <div className="amount">
            <span className="currency">$</span>
            <span>{fmt(data.amount)}</span>
          </div>
          <span className={`delta${data.delta < 0 ? " down" : ""}`}>
            <i
              className={`ti ${data.delta >= 0 ? "ti-trending-up" : "ti-trending-down"}`}
              style={{ fontSize: 12 }}
            />
            <span>
              {data.delta > 0 ? "+" : ""}
              {data.delta}%
            </span>
          </span>
        </div>
        <span className="meta">{fmt(data.photos)} fotos</span>
      </div>

      <div className="sparkline" aria-hidden="true">
        <svg viewBox="0 0 160 44" preserveAspectRatio="none">
          <defs>
            <linearGradient id="spark-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F5820A" stopOpacity="0.32" />
              <stop offset="100%" stopColor="#F5820A" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path fill="url(#spark-grad)" d={spark.area} />
          <path
            fill="none"
            stroke="#F5820A"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            d={spark.line}
          />
          <circle r="2.6" fill="#F5820A" stroke="#0F0D0B" strokeWidth="1.4" cx={spark.lastX} cy={spark.lastY} />
        </svg>
      </div>

      <div className={`ts-drop ${open ? "open" : ""}`} ref={ref}>
        <button
          className={`ts-trigger ${open ? "open" : ""}`}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={(e) => {
            e.stopPropagation();
            setOpen((o) => !o);
          }}
        >
          <i className="ti ti-calendar-stats" style={{ fontSize: 14, color: "var(--text-tertiary)" }} />
          <span className="val">{data.trigger}</span>
          <i className="ti ti-chevron-down chev" />
        </button>
        <div className="ts-menu" role="listbox">
          {(["7d", "30d", "90d", "1y"] as Range[]).map((r) => (
            <button
              key={r}
              type="button"
              className={`ts-option ${r === range ? "active" : ""}`}
              onClick={() => {
                setRange(r);
                setOpen(false);
              }}
            >
              <span>{TS[r].label}</span>
              <span className="meta">{r}</span>
              <i className="ti ti-check check" />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
