"use client";

import { useEffect } from "react";

/**
 * Adds the `.in` class to every element with `.reveal` once it enters the
 * viewport. Mirrors the inline script that ships with designs/index.html.
 */
export function RevealOnScroll() {
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 },
    );

    const targets = document.querySelectorAll<HTMLElement>(".reveal");
    targets.forEach((el) => io.observe(el));

    return () => io.disconnect();
  }, []);

  return null;
}
