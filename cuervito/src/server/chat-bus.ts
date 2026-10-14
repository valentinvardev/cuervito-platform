import "server-only";

/**
 * El bus del chat de soporte: quién está escuchando y a quién avisar.
 *
 * Es el mismo mecanismo que sales-bus —pub/sub en memoria, dentro del proceso—
 * con dos canales: uno por usuario (su panel) y uno para todos los admins (la
 * bandeja de /admin/chat y el aviso del riel). Vale mientras pm2 corra UNA
 * instancia (ecosystem.config.cjs: fork, instances 1); el día que haya dos,
 * esto y sales-bus pasan juntos a Redis o a LISTEN/NOTIFY de Postgres.
 *
 * La presencia sale de acá y no de una tabla: "en línea" es que hay una
 * conexión SSE abierta, y eso lo sabe el proceso sin preguntarle a nadie. Un
 * admin cuenta como en línea sólo si tiene la bandeja abierta (marcó
 * `presencia` al conectarse), no por tener el panel en otra pestaña: "En
 * línea" en la burbuja del usuario es una promesa de respuesta, y se cumple
 * mejor cuando se dice menos veces.
 */

export type MensajeChatPayload = {
  id: string;
  conversacionId: string;
  /** El dueño de la conversación, que no es el autor cuando responde un admin. */
  userId: string;
  deAdmin: boolean;
  texto: string;
  createdAt: string; // ISO
  /** Para la bandeja del admin: a quién pertenece el hilo. */
  usuario?: { nombre: string; slug: string | null };
};

export type EventoChat =
  | { tipo: "mensaje"; mensaje: MensajeChatPayload }
  | { tipo: "leido"; conversacionId: string; lado: "usuario" | "admin" }
  | { tipo: "estado"; conversacionId: string; estado: "ABIERTA" | "RESUELTA" }
  | { tipo: "presencia"; adminsEnLinea: boolean };

type Listener = (e: EventoChat) => void;

type Bus = {
  usuarios: Map<string, Set<Listener>>;
  admins: Set<Listener>;
  /** Cuántas bandejas de admin hay abiertas (conexiones con presencia). */
  presenciaAdmin: number;
};

declare global {
  var __cuervito_chat_bus__: Bus | undefined;
}
const bus: Bus = globalThis.__cuervito_chat_bus__ ?? {
  usuarios: new Map(),
  admins: new Set(),
  presenciaAdmin: 0,
};
globalThis.__cuervito_chat_bus__ = bus;

function emitir(set: Set<Listener> | undefined, e: EventoChat) {
  if (!set) return;
  for (const l of set) {
    try {
      l(e);
    } catch (err) {
      console.error("[chat-bus] listener threw:", err);
    }
  }
}

export function suscribirUsuario(userId: string, listener: Listener): () => void {
  let set = bus.usuarios.get(userId);
  if (!set) {
    set = new Set();
    bus.usuarios.set(userId, set);
  }
  set.add(listener);
  return () => {
    const s = bus.usuarios.get(userId);
    if (!s) return;
    s.delete(listener);
    if (s.size === 0) bus.usuarios.delete(userId);
  };
}

export function suscribirAdmin(listener: Listener, presencia: boolean): () => void {
  bus.admins.add(listener);
  if (presencia) {
    bus.presenciaAdmin++;
    if (bus.presenciaAdmin === 1) avisarPresencia();
  }
  return () => {
    bus.admins.delete(listener);
    if (presencia) {
      bus.presenciaAdmin = Math.max(0, bus.presenciaAdmin - 1);
      if (bus.presenciaAdmin === 0) avisarPresencia();
    }
  };
}

/** Le avisa a todos los usuarios conectados que cambió si hay un admin. */
function avisarPresencia() {
  const e: EventoChat = { tipo: "presencia", adminsEnLinea: bus.presenciaAdmin > 0 };
  for (const set of bus.usuarios.values()) emitir(set, e);
}

export function adminsEnLinea(): boolean {
  return bus.presenciaAdmin > 0;
}

export function usuarioEnLinea(userId: string): boolean {
  return (bus.usuarios.get(userId)?.size ?? 0) > 0;
}

/** A los dos lados del hilo: el usuario dueño y todos los admins. */
export function publicarChat(userId: string, e: EventoChat): void {
  emitir(bus.usuarios.get(userId), e);
  emitir(bus.admins, e);
}
