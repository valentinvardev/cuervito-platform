/**
 * Cómo se nombran las fuentes en un diseño guardado: por la variable que
 * declara fuentes.ts, nunca por el nombre de la familia (ver ahí por qué).
 *
 * Archivo aparte para que el registro de plantillas —que lo importa el
 * store, del lado del cliente— no arrastre los cargadores de next/font.
 */
export const FAMILIAS = {
  instrumentSerif: "var(--pf-instrument-serif), Georgia, serif",
  geist: "var(--pf-geist), system-ui, sans-serif",
  geistMono: "var(--pf-geist-mono), ui-monospace, monospace",
  playfair: "var(--pf-playfair), Georgia, serif",
  manrope: "var(--pf-manrope), system-ui, sans-serif",
  plexMono: "var(--pf-plex-mono), ui-monospace, monospace",
  fraunces: "var(--pf-fraunces), Georgia, serif",
  spaceGrotesk: "var(--pf-space-grotesk), system-ui, sans-serif",
  spaceMono: "var(--pf-space-mono), ui-monospace, monospace",
} as const;
