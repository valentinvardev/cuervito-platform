"use client";

import { useEffect } from "react";

/**
 * Demo only: fires the sale toast once the user makes their first input gesture.
 * Browsers block WebAudio without prior interaction, so we wait for click/key.
 */
export function DemoSaleTrigger() {
  useEffect(() => {
    let fired = false;
    function trigger() {
      if (fired) return;
      fired = true;
      window.removeEventListener("pointerdown", trigger);
      window.removeEventListener("keydown", trigger);
      setTimeout(() => {
        window.cuervitoNotifySale?.({ amount: "$2.400", detail: "1 foto · Maratón BA" });
      }, 1800);
    }
    window.addEventListener("pointerdown", trigger, { once: true });
    window.addEventListener("keydown", trigger, { once: true });
    return () => {
      window.removeEventListener("pointerdown", trigger);
      window.removeEventListener("keydown", trigger);
    };
  }, []);
  return null;
}
