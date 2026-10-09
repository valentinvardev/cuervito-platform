/** Los íconos del panel de secciones de Podio, Fotofinish y Sendero. */

const base = { width: 12, height: 12, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round" } as const;

export const IconoNav = () => <svg {...base}><path d="M3 12h18M3 6h18M3 18h18" /></svg>;
export const IconoPortada = () => <svg {...base}><rect x="3" y="3" width="18" height="10" rx="1" /><path d="M3 17h18M7 21h10" /></svg>;
export const IconoCinta = () => <svg {...base}><path d="M2 9h20v6H2z" /><path d="M7 9l-2 6M13 9l-2 6M19 9l-2 6" /></svg>;
export const IconoCifras = () => <svg {...base}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>;
export const IconoGrilla = () => <svg {...base}><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg>;
export const IconoLista = () => <svg {...base}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>;
export const IconoCita = () => <svg {...base}><path d="M7 7h4v4c0 3-2 5-4 6M15 7h4v4c0 3-2 5-4 6" /></svg>;
export const IconoPersona = () => <svg {...base}><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>;
export const IconoMail = () => <svg {...base}><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M22 7l-8.97 5.7a1.94 1.94 0 01-2.06 0L2 7" /></svg>;
export const IconoPie = () => <svg {...base}><path d="M3 7h18M3 12h18M3 17h8" /></svg>;
