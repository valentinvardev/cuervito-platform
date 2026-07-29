"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Side = "top" | "bottom" | "left" | "right";

const OFFSET = 10;
const OPEN_DELAY = 400;

type TipState = {
  text: string;
  top: number;
  left: number;
  side: Side;
};

/**
 * Provider global de tooltips. Se monta una vez por layout y escucha
 * mouseover/focusin en todo el árbol. Cualquier elemento con el
 * atributo `data-tip="texto"` obtiene tooltip — no hace falta
 * envolverlo en un componente.
 *
 * Opcionalmente `data-tip-side="top|bottom|left|right"` fuerza el lado
 * (por defecto "top", con auto-flip si no entra en el viewport).
 *
 * Ventaja sobre <Tooltip>: se aplica a cientos de botones con un
 * atributo, funciona en server components, y no re-renderiza el árbol.
 */
export function TooltipProvider() {
  const [tip, setTip] = useState<TipState | null>(null);
  const [mounted, setMounted] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const targetRef = useRef<HTMLElement | null>(null);
  const tipRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    function clear() {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      targetRef.current = null;
      setTip(null);
    }

    function findTarget(node: EventTarget | null): HTMLElement | null {
      if (!(node instanceof Element)) return null;
      const el = node.closest<HTMLElement>("[data-tip]");
      if (!el) return null;
      // Elementos deshabilitados igual muestran tooltip (suele ser el
      // caso donde más se necesita explicar por qué no se puede usar).
      return el;
    }

    function show(el: HTMLElement, immediate: boolean) {
      const text = el.dataset.tip?.trim();
      if (!text) return;
      targetRef.current = el;

      const run = () => {
        if (targetRef.current !== el || !el.isConnected) return;
        const requested = (el.dataset.tipSide as Side | undefined) ?? "top";
        setTip({ text, top: -9999, left: -9999, side: requested });
      };

      if (timerRef.current) clearTimeout(timerRef.current);
      if (immediate) run();
      else timerRef.current = setTimeout(run, OPEN_DELAY);
    }

    function onOver(e: MouseEvent) {
      const el = findTarget(e.target);
      if (!el) {
        if (targetRef.current) clear();
        return;
      }
      if (el === targetRef.current) return;
      show(el, false);
    }

    function onFocusIn(e: FocusEvent) {
      const el = findTarget(e.target);
      if (el) show(el, true);
    }

    function onLeaveOrBlur(e: Event) {
      const el = findTarget(e.target);
      if (el && el === targetRef.current) clear();
    }

    document.addEventListener("mouseover", onOver);
    document.addEventListener("mouseout", onLeaveOrBlur);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onLeaveOrBlur);
    // Cerrar en cualquier interacción que cambie el layout.
    document.addEventListener("click", clear);
    window.addEventListener("scroll", clear, true);
    window.addEventListener("resize", clear);
    document.addEventListener("keydown", (e) => {
      if ((e as KeyboardEvent).key === "Escape") clear();
    });

    return () => {
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("mouseout", onLeaveOrBlur);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onLeaveOrBlur);
      document.removeEventListener("click", clear);
      window.removeEventListener("scroll", clear, true);
      window.removeEventListener("resize", clear);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Segunda pasada: una vez montada la burbuja medimos y posicionamos.
  useEffect(() => {
    if (!tip || tip.top !== -9999) return;
    const el = targetRef.current;
    const bubble = tipRef.current;
    if (!el || !bubble) return;

    const t = el.getBoundingClientRect();
    const b = bubble.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let side = tip.side;
    if (side === "top" && t.top - b.height - OFFSET < 8) side = "bottom";
    else if (side === "bottom" && t.bottom + b.height + OFFSET > vh - 8) side = "top";
    else if (side === "left" && t.left - b.width - OFFSET < 8) side = "right";
    else if (side === "right" && t.right + b.width + OFFSET > vw - 8) side = "left";

    let top: number;
    let left: number;
    if (side === "top" || side === "bottom") {
      top = side === "top" ? t.top - b.height - OFFSET : t.bottom + OFFSET;
      left = t.left + t.width / 2 - b.width / 2;
    } else {
      left = side === "left" ? t.left - b.width - OFFSET : t.right + OFFSET;
      top = t.top + t.height / 2 - b.height / 2;
    }

    left = Math.max(8, Math.min(vw - b.width - 8, left));
    top = Math.max(8, Math.min(vh - b.height - 8, top));

    setTip((prev) => (prev ? { ...prev, top, left, side } : prev));
  }, [tip]);

  if (!mounted || !tip) return null;

  return createPortal(
    <div
      ref={tipRef}
      role="tooltip"
      className={`cs-tooltip cs-tooltip-${tip.side}`}
      style={{
        top: tip.top,
        left: tip.left,
        // Mientras medimos la mantenemos invisible para evitar el salto.
        visibility: tip.top === -9999 ? "hidden" : "visible",
      }}
    >
      {tip.text}
      <span className="cs-tooltip-arrow" aria-hidden />
    </div>,
    document.body,
  );
}
