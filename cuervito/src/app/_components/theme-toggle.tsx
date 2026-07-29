"use client";

import { useEffect, useState } from "react";

// Two-state toggle (light ↔ dark). Persists in localStorage under
// 'cuervito-theme'. The initial value comes from data-theme on <html>
// (set by the pre-hydration script in layout.tsx), so this component
// never causes a hydration mismatch.
export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);

  useEffect(() => {
    const current = document.documentElement.dataset.theme;
    setTheme(current === "light" ? "light" : "dark");
  }, []);

  function toggle() {
    const next = theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("cuervito-theme", next);
    setTheme(next);
  }

  if (theme === null) {
    // Placeholder box so the nav doesn't reflow after hydration.
    return <span className="theme-toggle" aria-hidden style={{ visibility: "hidden" }} />;
  }

  const label = theme === "light" ? "Modo noche" : "Modo día";
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      data-tip={label}
      data-tip-side="bottom"
      aria-label={label}
    >
      <i className={`ti ${theme === "light" ? "ti-moon" : "ti-sun"}`} aria-hidden />
    </button>
  );
}
