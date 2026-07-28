"use client";

import { useEffect, useId, useRef, useState } from "react";

export type SelectOption = {
  value: string;
  label: string;
  meta?: string;
};

/**
 * Custom dropdown that replaces native <select> inside the dashboard/admin.
 * Same visual language as the sales-mini timeseries picker (`.ts-drop`) but
 * generic and keyboard-accessible. Styles live in dashboard.css under
 * `.cs-*`; both dark and light themes come for free via CSS tokens.
 */
export function Select({
  value,
  onChange,
  options,
  placeholder,
  icon,
  ariaLabel,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  placeholder?: string;
  icon?: string;
  ariaLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const selected = options.find((o) => o.value === value);
  const selectedIdx = Math.max(0, options.findIndex((o) => o.value === value));

  useEffect(() => {
    if (!open) return;
    setActive(selectedIdx);
    function onDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
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
  }, [open, selectedIdx]);

  function onTriggerKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
    }
  }

  function onListKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(options.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const o = options[active];
      if (o) {
        onChange(o.value);
        setOpen(false);
      }
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(options.length - 1);
    }
  }

  return (
    <div ref={wrapRef} className={`cs-select ${open ? "open" : ""} ${className ?? ""}`}>
      <button
        type="button"
        className={`cs-trigger ${open ? "open" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-label={ariaLabel}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        onKeyDown={onTriggerKey}
      >
        {icon && <i className={`ti ${icon}`} aria-hidden />}
        <span className="val">{selected?.label ?? placeholder ?? "Elegir"}</span>
        <i className="ti ti-chevron-down chev" aria-hidden />
      </button>
      {open && (
        <div
          className="cs-menu"
          role="listbox"
          id={listboxId}
          tabIndex={-1}
          onKeyDown={onListKey}
        >
          {options.map((o, i) => (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={o.value === value}
              className={`cs-option ${o.value === value ? "active" : ""} ${i === active ? "focus" : ""}`}
              onMouseEnter={() => setActive(i)}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
            >
              <span>{o.label}</span>
              {o.meta && <span className="meta">{o.meta}</span>}
              <i className="ti ti-check check" aria-hidden />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
