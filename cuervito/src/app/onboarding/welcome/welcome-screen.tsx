"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { ObShell } from "../ob-shell";

const CONFETTI_COLORS = ["#F5820A", "#FF9A2E", "#4CAF7D", "#F5C842", "#F0EBE3", "#7A3D05"];
const CONFETTI_COUNT = 56;

export function WelcomeScreen() {
  const router = useRouter();
  const confettiRef = useRef<HTMLDivElement>(null);

  // Slide the sidebar out, fire confetti, then fade-out & redirect to dashboard.
  useEffect(() => {
    document.body.classList.add("welcome-mode");

    // Confetti
    const wrap = confettiRef.current;
    if (wrap) {
      wrap.innerHTML = "";
      for (let i = 0; i < CONFETTI_COUNT; i++) {
        const el = document.createElement("div");
        el.className = "confetti";
        const w = 6 + Math.random() * 6;
        const h = 10 + Math.random() * 8;
        const left = Math.random() * 100;
        const dx = (Math.random() - 0.5) * 220;
        const rot = (Math.random() < 0.5 ? -1 : 1) * (480 + Math.random() * 720);
        const dur = 2.6 + Math.random() * 1.6;
        const delay = Math.random() * 0.6;
        el.style.left = left + "%";
        el.style.setProperty("--w", w + "px");
        el.style.setProperty("--h", h + "px");
        el.style.setProperty("--c", CONFETTI_COLORS[i % CONFETTI_COLORS.length]!);
        el.style.setProperty("--dx", dx + "px");
        el.style.setProperty("--rot", rot + "deg");
        el.style.setProperty("--dur", dur + "s");
        el.style.setProperty("--delay", delay + "s");
        wrap.appendChild(el);
      }
    }

    // Body fade-out + redirect
    const fadeAt = 3400;
    const fadeT = setTimeout(() => {
      document.body.classList.add("leaving");
    }, fadeAt);
    const navT = setTimeout(() => {
      router.push("/dashboard");
    }, fadeAt + 380);

    return () => {
      clearTimeout(fadeT);
      clearTimeout(navT);
      document.body.classList.remove("welcome-mode", "leaving");
    };
  }, [router]);

  return (
    <>
      <ObShell step={2}>
        <section className="step-content success-screen">
          <div className="welcome-wrap">
            <div className="welcome-circle">
              <i className="ti ti-check" />
            </div>
            <h1 className="welcome-title">
              ¡Bienvenido a <span className="brand">Cuervito.app</span>!
            </h1>
            <p className="welcome-sub">Tu perfil está listo. Te estamos llevando al panel…</p>
            <div className="welcome-loader">
              <span></span>
            </div>
          </div>
        </section>
      </ObShell>
      <div className="confetti-container" ref={confettiRef} />
    </>
  );
}
