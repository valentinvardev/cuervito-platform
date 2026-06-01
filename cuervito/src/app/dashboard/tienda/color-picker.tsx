"use client";

import { useEffect, useRef, useState } from "react";

// ── Color math ──────────────────────────────────────────────────────────────
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return { r: 0, g: 0, b: 0 };
  const n = parseInt(m[1]!, 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

function rgbToHex(r: number, g: number, b: number): string {
  const to = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`.toUpperCase();
}

function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  return { h, s, v: max };
}

function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const c = v * s;
  const hh = h / 60;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  if (hh >= 0 && hh < 1) [r1, g1, b1] = [c, x, 0];
  else if (hh < 2) [r1, g1, b1] = [x, c, 0];
  else if (hh < 3) [r1, g1, b1] = [0, c, x];
  else if (hh < 4) [r1, g1, b1] = [0, x, c];
  else if (hh < 5) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];
  const m = v - c;
  return { r: (r1 + m) * 255, g: (g1 + m) * 255, b: (b1 + m) * 255 };
}

function hexToHsv(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHsv(r, g, b);
}

function hsvToHex(h: number, s: number, v: number) {
  const { r, g, b } = hsvToRgb(h, s, v);
  return rgbToHex(r, g, b);
}

// ── Component ───────────────────────────────────────────────────────────────
export function ColorPicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (hex: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [h, setH] = useState(0);
  const [s, setS] = useState(0);
  const [v, setV] = useState(0);
  const [hexInput, setHexInput] = useState(value);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Sync external value → internal HSV when opening
  useEffect(() => {
    if (!open) return;
    const hsv = hexToHsv(value);
    setH(hsv.h);
    setS(hsv.s);
    setV(hsv.v);
    setHexInput(value);
  }, [open, value]);

  // Outside click + Escape closes
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function commitHsv(nh: number, ns: number, nv: number) {
    setH(nh);
    setS(ns);
    setV(nv);
    const hex = hsvToHex(nh, ns, nv);
    setHexInput(hex);
    onChange(hex);
  }

  // ── Pointer tracking for the SV square + hue strip ─────────────────────────
  function trackSquare(e: React.PointerEvent<HTMLDivElement>) {
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    const update = (clientX: number, clientY: number) => {
      const rect = target.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
      commitHsv(h, x, 1 - y);
    };
    update(e.clientX, e.clientY);
    const onMove = (ev: PointerEvent) => update(ev.clientX, ev.clientY);
    const onUp = (ev: PointerEvent) => {
      target.releasePointerCapture(ev.pointerId);
      target.removeEventListener("pointermove", onMove);
      target.removeEventListener("pointerup", onUp);
      target.removeEventListener("pointercancel", onUp);
    };
    target.addEventListener("pointermove", onMove);
    target.addEventListener("pointerup", onUp);
    target.addEventListener("pointercancel", onUp);
  }

  function trackHue(e: React.PointerEvent<HTMLDivElement>) {
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    const update = (clientX: number) => {
      const rect = target.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      commitHsv(x * 360, s, v);
    };
    update(e.clientX);
    const onMove = (ev: PointerEvent) => update(ev.clientX);
    const onUp = (ev: PointerEvent) => {
      target.releasePointerCapture(ev.pointerId);
      target.removeEventListener("pointermove", onMove);
      target.removeEventListener("pointerup", onUp);
      target.removeEventListener("pointercancel", onUp);
    };
    target.addEventListener("pointermove", onMove);
    target.addEventListener("pointerup", onUp);
    target.addEventListener("pointercancel", onUp);
  }

  function onHexInputChange(raw: string) {
    let v2 = raw.toUpperCase();
    if (!v2.startsWith("#")) v2 = `#${v2}`;
    setHexInput(v2);
    if (/^#[0-9A-F]{6}$/.test(v2)) {
      const hsv = hexToHsv(v2);
      setH(hsv.h);
      setS(hsv.s);
      setV(hsv.v);
      onChange(v2);
    }
  }

  const hueColor = hsvToHex(h, 1, 1);

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          height: 44,
          padding: "0 14px 0 8px",
          borderRadius: 11,
          background: "var(--bg-surface)",
          border: open ? "1px solid var(--border-accent)" : "1px solid var(--border-subtle)",
          color: "var(--text-primary)",
          cursor: disabled ? "not-allowed" : "pointer",
          fontSize: 14,
          fontWeight: 500,
          transition: "border-color 150ms",
        }}
      >
        <span
          aria-hidden
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: value,
            border: "1px solid rgba(0,0,0,0.25)",
            boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.18)",
            flexShrink: 0,
          }}
        />
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>{value}</span>
        <i
          className="ti ti-color-picker"
          style={{ fontSize: 18, color: "var(--text-tertiary)", marginLeft: 4 }}
        />
      </button>

      {open && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label="Selector de color"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: 0,
            zIndex: 50,
            width: 260,
            padding: 14,
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-default)",
            borderRadius: 14,
            boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {/* SV square */}
          <div
            onPointerDown={trackSquare}
            style={{
              position: "relative",
              width: "100%",
              aspectRatio: "1 / 0.78",
              borderRadius: 10,
              overflow: "hidden",
              cursor: "crosshair",
              background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueColor})`,
              touchAction: "none",
              userSelect: "none",
            }}
          >
            <span
              aria-hidden
              style={{
                position: "absolute",
                left: `${s * 100}%`,
                top: `${(1 - v) * 100}%`,
                transform: "translate(-50%, -50%)",
                width: 14,
                height: 14,
                borderRadius: "50%",
                border: "2px solid white",
                boxShadow: "0 0 0 1px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.45)",
                background: hsvToHex(h, s, v),
                pointerEvents: "none",
              }}
            />
          </div>

          {/* Hue strip */}
          <div
            onPointerDown={trackHue}
            style={{
              position: "relative",
              height: 12,
              borderRadius: 999,
              cursor: "pointer",
              background:
                "linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)",
              touchAction: "none",
              userSelect: "none",
            }}
          >
            <span
              aria-hidden
              style={{
                position: "absolute",
                left: `${(h / 360) * 100}%`,
                top: "50%",
                transform: "translate(-50%, -50%)",
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: hueColor,
                border: "2px solid white",
                boxShadow: "0 0 0 1px rgba(0,0,0,0.6), 0 2px 6px rgba(0,0,0,0.4)",
                pointerEvents: "none",
              }}
            />
          </div>

          {/* Hex input */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span
              aria-hidden
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: hexInput,
                border: "1px solid var(--border-subtle)",
                flexShrink: 0,
              }}
            />
            <input
              type="text"
              value={hexInput}
              onChange={(e) => onHexInputChange(e.target.value)}
              maxLength={7}
              spellCheck={false}
              autoComplete="off"
              style={{
                flex: 1,
                height: 32,
                padding: "0 10px",
                borderRadius: 8,
                background: "var(--bg-base)",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-primary)",
                fontFamily: "var(--font-mono)",
                fontSize: 13,
                outline: "none",
                textTransform: "uppercase",
              }}
            />
          </div>

          <button
            type="button"
            onClick={() => setOpen(false)}
            className="btn btn-primary"
            style={{ height: 34, fontSize: 13, padding: "0 14px" }}
          >
            <i className="ti ti-check" />
            Aplicar
          </button>
        </div>
      )}
    </div>
  );
}
