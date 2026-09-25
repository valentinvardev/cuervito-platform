/** Los estados y las alertas que comparten las partes de la salud. */

export type Estado = "ok" | "degraded" | "down";
export type Alerta = { severity: "critical" | "warning"; code: string; message: string };

const PEOR: Record<Estado, number> = { ok: 0, degraded: 1, down: 2 };
export function peor(...estados: Estado[]): Estado {
  return estados.reduce<Estado>((a, b) => (PEOR[b] > PEOR[a] ? b : a), "ok");
}
