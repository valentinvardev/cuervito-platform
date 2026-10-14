import type { MensajeDTO } from "~/server/chat";

/**
 * Lo que la burbuja y la bandeja del admin comparten para dibujar un hilo.
 * Sin nada del servidor: lo importan componentes cliente, y chat.ts toma de
 * acá el largo máximo para que sea UN número y no tres.
 */

/** Caracteres por mensaje. El servidor recorta; el campo no deja pasar más. */
export const MAX_TEXTO = 2000;

export function horaDe(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });
}

/** "Hoy", "Ayer" o "12 de octubre": el separador entre días del hilo. */
export function diaDe(iso: string): string {
  const d = new Date(iso);
  const hoy = new Date();
  const mismo = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (mismo(d, hoy)) return "Hoy";
  const ayer = new Date(hoy);
  ayer.setDate(hoy.getDate() - 1);
  if (mismo(d, ayer)) return "Ayer";
  return d.toLocaleDateString("es-AR", {
    day: "numeric",
    month: "long",
    ...(d.getFullYear() === hoy.getFullYear() ? {} : { year: "numeric" }),
  });
}

/**
 * Suma mensajes al hilo sin repetir ninguno y en orden. Hace falta porque el
 * mismo mensaje puede llegar dos veces: por la acción que lo mandó y por el
 * SSE, o por el SSE y por la recarga de la reconexión.
 */
export function unirMensajes(previos: MensajeDTO[], nuevos: MensajeDTO[]): MensajeDTO[] {
  if (nuevos.length === 0) return previos;
  const vistos = new Set(previos.map((m) => m.id));
  const extra = nuevos.filter((m) => !vistos.has(m.id));
  if (extra.length === 0) return previos;
  return [...previos, ...extra].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** El hilo partido por día, para los separadores. */
export function porDia(mensajes: MensajeDTO[]): { dia: string; mensajes: MensajeDTO[] }[] {
  const grupos: { dia: string; mensajes: MensajeDTO[] }[] = [];
  for (const m of mensajes) {
    const dia = diaDe(m.createdAt);
    const ultimo = grupos[grupos.length - 1];
    if (ultimo?.dia === dia) ultimo.mensajes.push(m);
    else grupos.push({ dia, mensajes: [m] });
  }
  return grupos;
}
