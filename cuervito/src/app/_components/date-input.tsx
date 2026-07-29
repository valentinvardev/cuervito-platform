"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

// Lunes primero, en español.
const DOW_SHORT = ["L", "M", "M", "J", "V", "S", "D"];

/**
 * Reemplazo custom del <input type="date"> nativo. Muestra un input
 * de solo lectura con formato local es-AR y abre un popup calendario
 * al focus / click. Emite el valor en formato ISO YYYY-MM-DD (mismo
 * shape que el input nativo, así el server action lo consume igual).
 *
 * - Hoy queda marcado con ring naranja pero no seleccionado por default.
 * - Prev/next month con arrows.
 * - Clear con botón dentro del popup.
 * - Popup portaleado al body, auto-flipea si no entra abajo.
 */
export function DateInput({
  name,
  value,
  onChange,
  placeholder = "dd / mm / aaaa",
  ariaLabel,
  id,
}: {
  name?: string;
  value: string;
  onChange: (iso: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState<number>(() => {
    const d = value ? new Date(value + "T12:00:00") : new Date();
    return d.getFullYear();
  });
  const [viewMonth, setViewMonth] = useState<number>(() => {
    const d = value ? new Date(value + "T12:00:00") : new Date();
    return d.getMonth();
  });
  const [pos, setPos] = useState<{ top: number; left: number; flipUp: boolean } | null>(null);
  const [mounted, setMounted] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const autoId = useId();
  const inputId = id ?? autoId;

  useEffect(() => setMounted(true), []);

  // Reset del mes visible cuando cambia el value externo.
  useEffect(() => {
    if (!value) return;
    const d = new Date(value + "T12:00:00");
    if (Number.isNaN(d.getTime())) return;
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }, [value]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setOpen(false);
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

  // Position popup on open + on scroll/resize.
  useEffect(() => {
    if (!open || !wrapRef.current) return;
    const compute = () => {
      const r = wrapRef.current!.getBoundingClientRect();
      const POP_H = 320;
      const POP_W = 300;
      const spaceBelow = window.innerHeight - r.bottom;
      const flipUp = spaceBelow < POP_H + 12 && r.top > POP_H + 12;
      const top = flipUp ? r.top - POP_H - 8 : r.bottom + 8;
      let left = r.left;
      if (left + POP_W > window.innerWidth - 8) left = window.innerWidth - POP_W - 8;
      if (left < 8) left = 8;
      setPos({ top, left, flipUp });
    };
    compute();
    window.addEventListener("scroll", compute, true);
    window.addEventListener("resize", compute);
    return () => {
      window.removeEventListener("scroll", compute, true);
      window.removeEventListener("resize", compute);
    };
  }, [open]);

  const today = useMemo(() => new Date(), []);
  const todayY = today.getFullYear();
  const todayM = today.getMonth();
  const todayD = today.getDate();
  const selectedISO = value || null;

  const cells = useMemo(
    () => buildMonth(viewYear, viewMonth),
    [viewYear, viewMonth],
  );

  function displayValue(): string {
    if (!value) return "";
    const d = new Date(value + "T12:00:00");
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  function pick(y: number, m: number, d: number) {
    const iso = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    onChange(iso);
    setOpen(false);
  }

  function shiftMonth(delta: number) {
    let m = viewMonth + delta;
    let y = viewYear;
    while (m < 0) {
      m += 12;
      y -= 1;
    }
    while (m > 11) {
      m -= 12;
      y += 1;
    }
    setViewMonth(m);
    setViewYear(y);
  }

  return (
    <div ref={wrapRef} className={`cs-date-wrap ${open ? "open" : ""}`}>
      {/* Hidden field para que el server action reciba el ISO. */}
      {name && <input type="hidden" name={name} value={value} />}
      <button
        id={inputId}
        type="button"
        className="cs-date-trigger input"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        <i className="ti ti-calendar-event" aria-hidden />
        <span className={`cs-date-value ${value ? "" : "is-placeholder"}`}>
          {value ? displayValue() : placeholder}
        </span>
        {value && (
          <button
            type="button"
            className="cs-date-clear"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
            aria-label="Limpiar fecha"
          >
            <i className="ti ti-x" />
          </button>
        )}
      </button>

      {mounted && open && pos &&
        createPortal(
          <div
            ref={popRef}
            className={`cs-date-pop ${pos.flipUp ? "flip-up" : ""}`}
            style={{ top: pos.top, left: pos.left }}
            role="dialog"
            aria-modal={false}
            aria-labelledby={listboxId}
          >
            <div className="cs-date-head">
              <button
                type="button"
                className="cs-date-nav"
                onClick={() => shiftMonth(-1)}
                aria-label="Mes anterior"
              >
                <i className="ti ti-chevron-left" />
              </button>
              <div id={listboxId} className="cs-date-title">
                {MONTHS[viewMonth]} {viewYear}
              </div>
              <button
                type="button"
                className="cs-date-nav"
                onClick={() => shiftMonth(1)}
                aria-label="Mes siguiente"
              >
                <i className="ti ti-chevron-right" />
              </button>
            </div>

            <div className="cs-date-dow" aria-hidden>
              {DOW_SHORT.map((d, i) => (
                <span key={i}>{d}</span>
              ))}
            </div>

            <div className="cs-date-grid" role="grid">
              {cells.map((cell, i) => {
                if (!cell) return <span key={i} className="cs-date-empty" />;
                const isToday =
                  cell.y === todayY && cell.m === todayM && cell.d === todayD;
                const iso = `${cell.y}-${String(cell.m + 1).padStart(2, "0")}-${String(cell.d).padStart(2, "0")}`;
                const isSelected = iso === selectedISO;
                return (
                  <button
                    key={i}
                    type="button"
                    className={`cs-date-day ${isToday ? "is-today" : ""} ${isSelected ? "is-selected" : ""}`}
                    onClick={() => pick(cell.y, cell.m, cell.d)}
                    aria-pressed={isSelected}
                    aria-label={new Date(cell.y, cell.m, cell.d).toLocaleDateString("es-AR", { dateStyle: "full" })}
                  >
                    {cell.d}
                  </button>
                );
              })}
            </div>

            <div className="cs-date-foot">
              <button
                type="button"
                className="cs-date-foot-btn"
                onClick={() => {
                  pick(todayY, todayM, todayD);
                }}
              >
                Hoy
              </button>
              <button
                type="button"
                className="cs-date-foot-btn ghost"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
              >
                Limpiar
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

/** Devuelve el array 6x7 de celdas para el mes, con nulls para padding. */
function buildMonth(year: number, month: number): (null | { y: number; m: number; d: number })[] {
  const first = new Date(year, month, 1);
  // JS: 0=Domingo. Queremos Lunes=0.
  const firstDow = (first.getDay() + 6) % 7;
  const last = new Date(year, month + 1, 0).getDate();
  const cells: (null | { y: number; m: number; d: number })[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= last; d++) cells.push({ y: year, m: month, d });
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
