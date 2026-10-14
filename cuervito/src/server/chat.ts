import "server-only";

import { MAX_TEXTO } from "~/app/dashboard/_components/chat/formato-chat";
import { db } from "~/server/db";

import { BASE } from "./correos/base";
import { chatMensajeHtml, chatRespuestaHtml } from "./correos/transaccionales";
import { adminsEnLinea, publicarChat, usuarioEnLinea, type MensajeChatPayload } from "./chat-bus";
import { sendEmail } from "./email";

/**
 * El chat de soporte: las reglas, en un solo lugar.
 *
 * Las acciones del panel y del admin, y las rutas SSE, llaman acá después de
 * comprobar quién es el que pide. Este módulo no mira la sesión: recibe ids
 * ya verificados, y por eso es server-only y no "use server" (ver _nucleo.ts
 * para el porqué: lo exportado desde "use server" es un endpoint público).
 */

export { MAX_TEXTO };
/** Mensajes por minuto por usuario antes de frenarlo. */
const POR_MINUTO = 20;
/** Un aviso por mail por lado y por día: lo que pasa en el medio se ve en el panel. */
const AVISO_CADA_MS = 24 * 60 * 60 * 1000;
/** Cuántos mensajes se cargan de un hilo. Más viejo que esto no se muestra. */
const LARGO_HILO = 300;

export type MensajeDTO = {
  id: string;
  deAdmin: boolean;
  texto: string;
  /** ISO. */
  createdAt: string;
};

export type EstadoConversacion = "ABIERTA" | "RESUELTA";

/* ── Ritmo ───────────────────────────────────────────────────────────────── */

// En memoria y global por el HMR, como el bus: una ventana deslizante de un
// minuto por usuario. Con una sola instancia alcanza; con dos, a Redis junto
// con el bus.
declare global {
  var __cuervito_chat_ritmo__: Map<string, number[]> | undefined;
}
const ritmo: Map<string, number[]> = globalThis.__cuervito_chat_ritmo__ ?? new Map<string, number[]>();
globalThis.__cuervito_chat_ritmo__ = ritmo;

function dentroDelRitmo(userId: string): boolean {
  const ahora = Date.now();
  const recientes = (ritmo.get(userId) ?? []).filter((t) => ahora - t < 60_000);
  if (recientes.length >= POR_MINUTO) {
    ritmo.set(userId, recientes);
    return false;
  }
  recientes.push(ahora);
  ritmo.set(userId, recientes);
  return true;
}

/* ── Texto ───────────────────────────────────────────────────────────────── */

/**
 * Texto plano, nada más: sin HTML (se escapa al dibujar), sin más de dos
 * saltos seguidos, recortado. Devuelve null si no queda nada.
 */
export function limpiarTexto(t: unknown): string | null {
  if (typeof t !== "string") return null;
  const limpio = t
    .replace(/\r\n?/g, "\n")
    .replace(/[^\S\n]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!limpio) return null;
  return limpio.length > MAX_TEXTO ? limpio.slice(0, MAX_TEXTO) : limpio;
}

function aDTO(m: { id: string; deAdmin: boolean; texto: string; createdAt: Date }): MensajeDTO {
  return { id: m.id, deAdmin: m.deAdmin, texto: m.texto, createdAt: m.createdAt.toISOString() };
}

function nombreDe(u: { name: string | null; email: string | null; slug: string | null }): string {
  // `||` y no `??`: un nombre vacío también cae al siguiente.
  const n = u.name?.trim();
  if (n) return n;
  return u.slug ?? u.email ?? "Alguien";
}

/* ── Lado usuario ────────────────────────────────────────────────────────── */

export type HiloUsuario = {
  estado: EstadoConversacion | null;
  mensajes: MensajeDTO[];
  /** Mensajes del admin que el usuario todavía no vio. */
  noLeidos: number;
  adminsEnLinea: boolean;
};

/**
 * El hilo del usuario. Con `desde` (ISO) trae sólo lo que llegó a partir de
 * ese momento: es lo que pide el panel al reconectar el SSE, para no perder
 * lo que pasó mientras estaba cortado. Es `>=` y no `>` a propósito: dos
 * mensajes en el mismo milisegundo no se pierden, y el repetido lo descarta
 * el cliente por id.
 */
export async function hiloDeUsuario(userId: string, desde?: string): Promise<HiloUsuario> {
  const c = await db.conversacion.findUnique({
    where: { userId },
    select: { id: true, estado: true, leidoPorUsuarioAt: true },
  });
  if (!c) return { estado: null, mensajes: [], noLeidos: 0, adminsEnLinea: adminsEnLinea() };

  const desdeFecha = desde ? new Date(desde) : null;
  const [mensajes, noLeidos] = await Promise.all([
    db.mensajeChat.findMany({
      where: {
        conversacionId: c.id,
        ...(desdeFecha && !Number.isNaN(desdeFecha.getTime()) ? { createdAt: { gte: desdeFecha } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: LARGO_HILO,
      select: { id: true, deAdmin: true, texto: true, createdAt: true },
    }),
    db.mensajeChat.count({
      where: {
        conversacionId: c.id,
        deAdmin: true,
        ...(c.leidoPorUsuarioAt ? { createdAt: { gt: c.leidoPorUsuarioAt } } : {}),
      },
    }),
  ]);
  return {
    estado: c.estado,
    mensajes: mensajes.reverse().map(aDTO),
    noLeidos,
    adminsEnLinea: adminsEnLinea(),
  };
}

/** Lo que la burbuja necesita al conectarse: cuántos sin leer y si hay alguien. */
export async function noLeidosDeUsuario(userId: string): Promise<number> {
  const c = await db.conversacion.findUnique({
    where: { userId },
    select: { id: true, leidoPorUsuarioAt: true },
  });
  if (!c) return 0;
  return db.mensajeChat.count({
    where: {
      conversacionId: c.id,
      deAdmin: true,
      ...(c.leidoPorUsuarioAt ? { createdAt: { gt: c.leidoPorUsuarioAt } } : {}),
    },
  });
}

/* ── Escribir ────────────────────────────────────────────────────────────── */

export type ResultadoEnvio = { error: string } | { mensaje: MensajeDTO; conversacionId: string };

/**
 * Un mensaje nuevo, de cualquiera de los dos lados.
 *
 * `userId` es el dueño del hilo: el que escribe, si es el usuario, o a quién
 * le responde el admin. El hilo se crea con el primer mensaje. Un mensaje del
 * usuario vuelve a abrir una conversación resuelta: si escribe de nuevo es
 * porque no estaba resuelta.
 *
 * El lado que escribe queda como que leyó hasta ahora: si está escribiendo
 * es porque vio lo anterior.
 */
export async function enviarMensaje(i: {
  autorId: string;
  deAdmin: boolean;
  userId: string;
  texto: unknown;
}): Promise<ResultadoEnvio> {
  const texto = limpiarTexto(i.texto);
  if (!texto) return { error: "Escribí algo primero." };
  if (!dentroDelRitmo(i.autorId)) return { error: "Demasiados mensajes seguidos. Esperá un minuto." };

  const ahora = new Date();
  const marcaLeido = i.deAdmin ? { leidoPorAdminAt: ahora } : { leidoPorUsuarioAt: ahora };

  const conv = await db.conversacion.upsert({
    where: { userId: i.userId },
    create: { userId: i.userId, ultimoMensajeAt: ahora, ...marcaLeido },
    update: {
      ultimoMensajeAt: ahora,
      ...marcaLeido,
      ...(i.deAdmin ? {} : { estado: "ABIERTA" as const }),
    },
    select: {
      id: true,
      estado: true,
      avisoUsuarioAt: true,
      avisoAdminAt: true,
      user: { select: { name: true, email: true, slug: true } },
    },
  });

  const m = await db.mensajeChat.create({
    data: { conversacionId: conv.id, autorId: i.autorId, deAdmin: i.deAdmin, texto, createdAt: ahora },
    select: { id: true, deAdmin: true, texto: true, createdAt: true },
  });

  const payload: MensajeChatPayload = {
    id: m.id,
    conversacionId: conv.id,
    userId: i.userId,
    deAdmin: m.deAdmin,
    texto: m.texto,
    createdAt: m.createdAt.toISOString(),
    usuario: { nombre: nombreDe(conv.user), slug: conv.user.slug },
  };
  publicarChat(i.userId, { tipo: "mensaje", mensaje: payload });
  if (!i.deAdmin && conv.estado === "RESUELTA") {
    // El upsert ya la abrió; a los que escuchan hay que decírselo aparte.
    publicarChat(i.userId, { tipo: "estado", conversacionId: conv.id, estado: "ABIERTA" });
  }

  // El aviso por mail no frena la respuesta: el mensaje ya está guardado y
  // publicado, y si Resend tarda o falla, el chat sigue andando.
  void avisarPorMail({
    conversacionId: conv.id,
    userId: i.userId,
    deAdmin: i.deAdmin,
    texto,
    usuario: conv.user,
    avisoUsuarioAt: conv.avisoUsuarioAt,
    avisoAdminAt: conv.avisoAdminAt,
    ahora,
  }).catch((err) => console.error("[chat] aviso por mail:", err));

  return { mensaje: aDTO(m), conversacionId: conv.id };
}

/**
 * Un mail al otro lado, con dos frenos: que no esté conectado ahora mismo (si
 * lo está, lo ve), y que no le hayamos mandado otro en las últimas 24 horas.
 *
 * El freno de 24 horas se escribe ANTES de mandar, con una condición en el
 * update: si dos mensajes entran casi juntos, sólo uno encuentra la fila con
 * el aviso viejo y el otro no manda nada. Sin eso, los dos leerían "hace más
 * de un día" y saldrían dos mails.
 */
async function avisarPorMail(i: {
  conversacionId: string;
  userId: string;
  deAdmin: boolean;
  texto: string;
  usuario: { name: string | null; email: string | null; slug: string | null };
  avisoUsuarioAt: Date | null;
  avisoAdminAt: Date | null;
  ahora: Date;
}) {
  const limite = new Date(i.ahora.getTime() - AVISO_CADA_MS);
  const extracto = i.texto.length > 280 ? `${i.texto.slice(0, 277).trimEnd()}…` : i.texto;

  if (i.deAdmin) {
    // Al usuario: le respondieron.
    if (usuarioEnLinea(i.userId)) return;
    if (!i.usuario.email) return;
    const { count } = await db.conversacion.updateMany({
      where: { id: i.conversacionId, OR: [{ avisoUsuarioAt: null }, { avisoUsuarioAt: { lt: limite } }] },
      data: { avisoUsuarioAt: i.ahora },
    });
    if (count === 0) return;
    await sendEmail({
      to: i.usuario.email,
      subject: "Te respondieron en encontrate.app",
      html: chatRespuestaHtml({ name: i.usuario.name, extracto, url: `${BASE}/dashboard?chat=1` }),
      text: `Te respondieron en el chat de encontrate.app:\n\n${extracto}\n\nVer la respuesta: ${BASE}/dashboard?chat=1`,
    });
    return;
  }

  // A los admins: alguien escribió.
  if (adminsEnLinea()) return;
  const { count } = await db.conversacion.updateMany({
    where: { id: i.conversacionId, OR: [{ avisoAdminAt: null }, { avisoAdminAt: { lt: limite } }] },
    data: { avisoAdminAt: i.ahora },
  });
  if (count === 0) return;
  const admins = await db.user.findMany({
    where: { role: "ADMIN", status: "ACTIVE", email: { not: null } },
    select: { email: true },
  });
  const quien = nombreDe(i.usuario);
  const url = `${BASE}/admin/chat?c=${i.conversacionId}`;
  await Promise.all(
    admins.map((a) =>
      sendEmail({
        to: a.email!,
        subject: `${quien} te escribió por el chat`,
        html: chatMensajeHtml({ usuario: quien, email: i.usuario.email, extracto, url }),
        text: `${quien} (${i.usuario.email ?? "sin mail"}) escribió por el chat del panel:\n\n${extracto}\n\nResponder: ${url}`,
      }),
    ),
  );
}

/* ── Leído y estado ──────────────────────────────────────────────────────── */

export async function marcarLeidoUsuario(userId: string): Promise<void> {
  const ahora = new Date();
  const { count } = await db.conversacion.updateMany({
    where: { userId },
    data: { leidoPorUsuarioAt: ahora },
  });
  if (count === 0) return;
  const c = await db.conversacion.findUnique({ where: { userId }, select: { id: true } });
  if (c) publicarChat(userId, { tipo: "leido", conversacionId: c.id, lado: "usuario" });
}

export async function marcarLeidoAdmin(conversacionId: string): Promise<void> {
  const c = await db.conversacion.update({
    where: { id: conversacionId },
    data: { leidoPorAdminAt: new Date() },
    select: { userId: true },
  });
  publicarChat(c.userId, { tipo: "leido", conversacionId, lado: "admin" });
}

export async function cambiarEstado(conversacionId: string, estado: EstadoConversacion): Promise<void> {
  const c = await db.conversacion.update({
    where: { id: conversacionId },
    data: { estado },
    select: { userId: true },
  });
  publicarChat(c.userId, { tipo: "estado", conversacionId, estado });
}

/* ── Lado admin ──────────────────────────────────────────────────────────── */

/**
 * Conversaciones con algo que el admin no leyó. Se compara la fecha del último
 * mensaje con hasta dónde leyó: cuando el admin escribe, las dos quedan
 * iguales (mismo `ahora`), así que su propia respuesta no cuenta como
 * pendiente. Una sola consulta sobre Conversacion, sin mirar los mensajes:
 * esto corre en cada pantalla del admin, para el número del riel.
 */
export async function conversacionesPendientes(): Promise<number> {
  return db.conversacion.count({
    where: {
      OR: [{ leidoPorAdminAt: null }, { ultimoMensajeAt: { gt: db.conversacion.fields.leidoPorAdminAt } }],
    },
  });
}

export type FilaBandeja = {
  id: string;
  estado: EstadoConversacion;
  ultimoMensajeAt: string;
  noLeidos: number;
  usuario: { id: string; nombre: string; slug: string | null; email: string | null };
  ultimo: { deAdmin: boolean; texto: string } | null;
};

export async function bandeja(filtro: "abiertas" | "resueltas" | "todas"): Promise<FilaBandeja[]> {
  const where = filtro === "todas" ? {} : { estado: filtro === "abiertas" ? ("ABIERTA" as const) : ("RESUELTA" as const) };
  const [convs, pendientes] = await Promise.all([
    db.conversacion.findMany({
      where,
      orderBy: { ultimoMensajeAt: "desc" },
      take: 200,
      select: {
        id: true,
        estado: true,
        ultimoMensajeAt: true,
        user: { select: { id: true, name: true, slug: true, email: true } },
        mensajes: { orderBy: { createdAt: "desc" }, take: 1, select: { deAdmin: true, texto: true } },
      },
    }),
    // Cuántos mensajes del usuario después de hasta donde leyó el admin, por
    // conversación. Es un JOIN con una condición entre las dos tablas, que
    // Prisma no sabe escribir desde `include`.
    db.$queryRaw<{ conversacionId: string; n: number }[]>`
      SELECT m."conversacionId", COUNT(*)::int AS n
      FROM "MensajeChat" m
      JOIN "Conversacion" c ON c.id = m."conversacionId"
      WHERE m."deAdmin" = false
        AND (c."leidoPorAdminAt" IS NULL OR m."createdAt" > c."leidoPorAdminAt")
      GROUP BY m."conversacionId"`,
  ]);
  const noLeidos = new Map(pendientes.map((p) => [p.conversacionId, p.n]));
  return convs.map((c) => ({
    id: c.id,
    estado: c.estado,
    ultimoMensajeAt: c.ultimoMensajeAt.toISOString(),
    noLeidos: noLeidos.get(c.id) ?? 0,
    usuario: { id: c.user.id, nombre: nombreDe(c.user), slug: c.user.slug, email: c.user.email },
    ultimo: c.mensajes[0] ?? null,
  }));
}

export type HiloAdmin = {
  id: string;
  estado: EstadoConversacion;
  usuario: {
    id: string;
    nombre: string;
    slug: string | null;
    email: string | null;
    image: string | null;
    createdAt: string;
    mpConectado: boolean;
    eventos: number;
    ventas: number;
  };
  mensajes: MensajeDTO[];
};

export async function hiloAdmin(conversacionId: string): Promise<HiloAdmin | null> {
  const c = await db.conversacion.findUnique({
    where: { id: conversacionId },
    select: {
      id: true,
      estado: true,
      user: {
        select: {
          id: true,
          name: true,
          slug: true,
          email: true,
          image: true,
          createdAt: true,
          mpConnectedAt: true,
          _count: { select: { eventsOwned: true, sales: { where: { status: "PAID" } } } },
        },
      },
      mensajes: {
        orderBy: { createdAt: "desc" },
        take: LARGO_HILO,
        select: { id: true, deAdmin: true, texto: true, createdAt: true },
      },
    },
  });
  if (!c) return null;
  return {
    id: c.id,
    estado: c.estado,
    usuario: {
      id: c.user.id,
      nombre: nombreDe(c.user),
      slug: c.user.slug,
      email: c.user.email,
      image: c.user.image,
      createdAt: c.user.createdAt.toISOString(),
      mpConectado: !!c.user.mpConnectedAt,
      eventos: c.user._count.eventsOwned,
      ventas: c.user._count.sales,
    },
    mensajes: c.mensajes.reverse().map(aDTO),
  };
}

/** Mensajes de un hilo a partir de una fecha, para la reconexión del admin. */
export async function mensajesDesde(conversacionId: string, desde: string): Promise<MensajeDTO[]> {
  const d = new Date(desde);
  if (Number.isNaN(d.getTime())) return [];
  const ms = await db.mensajeChat.findMany({
    where: { conversacionId, createdAt: { gte: d } },
    orderBy: { createdAt: "asc" },
    take: LARGO_HILO,
    select: { id: true, deAdmin: true, texto: true, createdAt: true },
  });
  return ms.map(aDTO);
}
