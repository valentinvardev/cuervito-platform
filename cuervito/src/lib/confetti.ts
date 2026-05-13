/**
 * Confetti burst — used on /descarga and /pago/procesando.
 * Generates ~56 DOM nodes inside `container` with randomized animation params.
 * The CSS animation that drives them is in styles.css / descarga.css.
 */
const CONFETTI_COLORS = [
  "#F5820A",
  "#FF9A2E",
  "#4CAF7D",
  "#F5C842",
  "#F0EBE3",
  "#7A3D05",
];
const CONFETTI_COUNT = 56;

export function fireConfetti(container: HTMLDivElement) {
  container.innerHTML = "";
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
    el.style.setProperty(
      "--c",
      CONFETTI_COLORS[i % CONFETTI_COLORS.length]!,
    );
    el.style.setProperty("--dx", dx + "px");
    el.style.setProperty("--rot", rot + "deg");
    el.style.setProperty("--dur", dur + "s");
    el.style.setProperty("--delay", delay + "s");
    container.appendChild(el);
  }
}
