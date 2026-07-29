"use client";

import { cloneElement, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Side = "top" | "bottom" | "left" | "right";
type Align = "start" | "center" | "end";

const OFFSET = 8;
const OPEN_DELAY = 350;

/**
 * Tooltip flotante: envolvés cualquier elemento y lo describís con
 * `content`. Se activa por hover Y por focus (accesible con teclado).
 * Portal a document.body para no ser recortado por overflow parents.
 * Se auto-posiciona flipeando de lado si el borde de la ventana lo
 * fuerza. La animación de entrada respeta prefers-reduced-motion.
 */
export function Tooltip({
  children,
  content,
  side = "top",
  align = "center",
  className,
}: {
  children: React.ReactElement;
  content: React.ReactNode;
  side?: Side;
  align?: Align;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; side: Side } | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const id = useId();

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open || !triggerRef.current || !tipRef.current) return;
    const computePos = () => {
      const t = triggerRef.current!.getBoundingClientRect();
      const p = tipRef.current!.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      let chosen: Side = side;
      // Flip vertical si no entra
      if (side === "top" && t.top - p.height - OFFSET < 8) chosen = "bottom";
      else if (side === "bottom" && t.bottom + p.height + OFFSET > vh - 8) chosen = "top";
      else if (side === "left" && t.left - p.width - OFFSET < 8) chosen = "right";
      else if (side === "right" && t.right + p.width + OFFSET > vw - 8) chosen = "left";

      let top = 0;
      let left = 0;
      if (chosen === "top" || chosen === "bottom") {
        top = chosen === "top" ? t.top - p.height - OFFSET : t.bottom + OFFSET;
        if (align === "start") left = t.left;
        else if (align === "end") left = t.right - p.width;
        else left = t.left + t.width / 2 - p.width / 2;
      } else {
        left = chosen === "left" ? t.left - p.width - OFFSET : t.right + OFFSET;
        if (align === "start") top = t.top;
        else if (align === "end") top = t.bottom - p.height;
        else top = t.top + t.height / 2 - p.height / 2;
      }

      // Clamp al viewport (8px margen)
      left = Math.max(8, Math.min(vw - p.width - 8, left));
      top = Math.max(8, Math.min(vh - p.height - 8, top));
      setPos({ top, left, side: chosen });
    };
    computePos();
    window.addEventListener("scroll", computePos, true);
    window.addEventListener("resize", computePos);
    return () => {
      window.removeEventListener("scroll", computePos, true);
      window.removeEventListener("resize", computePos);
    };
  }, [open, side, align]);

  function scheduleOpen() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setOpen(true), OPEN_DELAY);
  }
  function cancelOpen() {
    if (timerRef.current) clearTimeout(timerRef.current);
    setOpen(false);
  }

  // Clonamos el child para inyectar ref + handlers sin wrapper extra.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const child = children as React.ReactElement<any>;
  const trigger = {
    ref: (node: HTMLElement | null) => {
      triggerRef.current = node;
      const orig = (child as unknown as { ref?: unknown }).ref;
      if (typeof orig === "function") (orig as (n: HTMLElement | null) => void)(node);
      else if (orig && typeof orig === "object" && "current" in orig) {
        (orig as { current: HTMLElement | null }).current = node;
      }
    },
    onMouseEnter: (e: React.MouseEvent) => {
      child.props.onMouseEnter?.(e);
      scheduleOpen();
    },
    onMouseLeave: (e: React.MouseEvent) => {
      child.props.onMouseLeave?.(e);
      cancelOpen();
    },
    onFocus: (e: React.FocusEvent) => {
      child.props.onFocus?.(e);
      setOpen(true);
    },
    onBlur: (e: React.FocusEvent) => {
      child.props.onBlur?.(e);
      cancelOpen();
    },
    "aria-describedby": open ? id : child.props["aria-describedby"],
  };

  return (
    <>
      {cloneElement(child, trigger)}
      {mounted && open && pos &&
        createPortal(
          <div
            ref={tipRef}
            id={id}
            role="tooltip"
            className={`cs-tooltip cs-tooltip-${pos.side} ${className ?? ""}`}
            style={{ top: pos.top, left: pos.left }}
          >
            {content}
            <span className="cs-tooltip-arrow" aria-hidden />
          </div>,
          document.body,
        )}
    </>
  );
}
