import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "~/env";
import { db } from "~/server/db";
import { sendEmail } from "~/server/email";
import { BASE } from "~/server/email-encontrate";
import { leerBandera } from "~/server/settings";

import { CAMPANAS, CAMPANAS_IDS, contarElegibles, elegibles, type CampanaId } from "./campanas";

/**
 * El remitente de campañas.
 *
 * Corre solo, en el proceso, con el mismo idioma que la cola de fotos: arranca
 * desde instrumentation.ts, tiene su estado en globalThis, y cada vuelta va en
 * su propio try/catch para que un error de conexión no lo apague hasta el
 * próximo deploy.
 *
 * Lo que garantiza que nadie recibe dos veces el mismo mail no está acá: está
 * en la base. EmailEnvio tiene una restricción única por (persona, campaña) y
 * la fila se escribe ANTES de mandar. Si dos pasadas se cruzan, la segunda
 * choca con la restricción y sigue de largo. Si el envío falla, la fila se
 * borra y la próxima pasada lo vuelve a intentar.
 *
 * Los topes son deliberadamente bajos. Resend corta a 100 por día en el plan
 * gratis y los proveedores de correo marcan como spam a quien pasa de cero a
 * mil en una tarde. Veinticinco por tanda, cada quince minutos, doscientos por
 * día: si algún día es poco, son tres constantes.
 */

const POR_TANDA = 25;
const TOPE_DIARIO = 200;
const TICK_MS = 15 * 60_000;
/** La primera pasada espera: que el proceso termine de levantar antes. */
const PRIMER_TICK_MS = 90_000;
/** Entre mail y mail. Resend admite diez por segundo; no hace falta rozarlo. */
const ENTRE_ENVIOS_MS = 400;

export const claveActiva = (id: CampanaId) => `correos:${id}:activa`;

type Resumen = {
  corridaAt: string;
  porCampana: Record<string, { enviados: number; fallidos: number; saltada?: string }>;
};

declare global {
  // eslint-disable-next-line no-var
  var __cuervito_correos__:
    | { arrancado: boolean; corriendo: boolean; ultimoResumen: Resumen | null }
    | undefined;
}
const estado = (globalThis.__cuervito_correos__ ??= {
  arrancado: false,
  corriendo: false,
  ultimoResumen: null,
});

/* ── La baja ────────────────────────────────────────────────────────────── */

/**
 * El link de baja lleva una firma, no un token guardado.
 *
 * Es un HMAC del id con el secreto de la app: no hay tabla de tokens, no
 * vence, y nadie puede fabricarlo para dar de baja a otro. Es lo mismo que
 * hacen los links de baja de cualquier newsletter seria.
 */
export function firmarBaja(userId: string): string {
  return createHmac("sha256", String(env.AUTH_SECRET ?? "sin-secreto"))
    .update(`baja:${userId}`)
    .digest("hex")
    .slice(0, 32);
}

export function verificarBaja(userId: string, firma: string): boolean {
  const esperada = Buffer.from(firmarBaja(userId));
  const dada = Buffer.from(firma);
  return esperada.length === dada.length && timingSafeEqual(esperada, dada);
}

export function bajaUrl(userId: string): string {
  return `${BASE}/correos/baja?u=${encodeURIComponent(userId)}&t=${firmarBaja(userId)}`;
}

/* ── Enviar ─────────────────────────────────────────────────────────────── */

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Cuántos salieron hoy (UTC), entre todas las campañas. */
async function enviadosHoy(): Promise<number> {
  const hoy = new Date();
  hoy.setUTCHours(0, 0, 0, 0);
  return db.emailEnvio.count({ where: { createdAt: { gte: hoy }, resendId: { not: null } } });
}

async function enviarCampana(
  id: CampanaId,
  limite: number,
): Promise<{ enviados: number; fallidos: number }> {
  const c = CAMPANAS[id];
  const gente = await elegibles(id, limite);
  let enviados = 0;
  let fallidos = 0;

  for (const u of gente) {
    /* El reclamo: la fila primero. Si ya existe —otra pasada llegó antes—
       Prisma tira P2002 y esta persona se saltea. */
    let fila: { id: string };
    try {
      fila = await db.emailEnvio.create({
        data: { userId: u.id, campana: id },
        select: { id: true },
      });
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") continue;
      throw e;
    }

    try {
      const mail = c.armar({ nombre: u.name, bajaUrl: bajaUrl(u.id) });
      const r = await sendEmail({ to: u.email, subject: mail.asunto, html: mail.html, text: mail.texto });
      if (!r) {
        // Sin RESEND_API_KEY: no se mandó nada, la fila no puede quedar.
        await db.emailEnvio.delete({ where: { id: fila.id } }).catch(() => undefined);
        console.warn(`[correos] ${id}: sin proveedor configurado, se detiene la campaña`);
        return { enviados, fallidos };
      }
      await db.emailEnvio.update({ where: { id: fila.id }, data: { resendId: r.id } });
      await c.alEnviar?.(u.id);
      enviados++;
      console.log(`[correos] ${id} → ${u.email} resend=${r.id}`);
    } catch (e) {
      // Falló el envío: se libera el reclamo para que se vuelva a intentar.
      await db.emailEnvio.delete({ where: { id: fila.id } }).catch(() => undefined);
      fallidos++;
      console.error(`[correos] ${id} → ${u.email} falló:`, e);
    }

    await dormir(ENTRE_ENVIOS_MS);
  }

  return { enviados, fallidos };
}

/** Una pasada: cada campaña activa, hasta el tope del día. */
export async function correrCorreos(): Promise<Resumen> {
  if (estado.corriendo) return estado.ultimoResumen ?? { corridaAt: "", porCampana: {} };
  estado.corriendo = true;

  const resumen: Resumen = { corridaAt: new Date().toISOString(), porCampana: {} };
  try {
    for (const id of CAMPANAS_IDS) {
      if (!(await leerBandera(claveActiva(id)))) {
        resumen.porCampana[id] = { enviados: 0, fallidos: 0, saltada: "apagada" };
        continue;
      }
      const cupo = TOPE_DIARIO - (await enviadosHoy());
      if (cupo <= 0) {
        resumen.porCampana[id] = { enviados: 0, fallidos: 0, saltada: "tope diario" };
        continue;
      }
      resumen.porCampana[id] = await enviarCampana(id, Math.min(POR_TANDA, cupo));
    }
  } finally {
    estado.corriendo = false;
    estado.ultimoResumen = resumen;
  }
  return resumen;
}

/* ── Arranque ───────────────────────────────────────────────────────────── */

export function arrancarCorreos(): void {
  if (estado.arrancado) return;
  if (!env.PROCESADOR_ACTIVO) return;
  estado.arrancado = true;
  console.log(`[correos] arranca · cada ${TICK_MS / 60_000} min, ${POR_TANDA} por tanda, ${TOPE_DIARIO} por día`);

  const tick = () => {
    correrCorreos().catch((e: unknown) => console.error("[correos] tick falló:", e));
  };
  const primero = setTimeout(tick, PRIMER_TICK_MS);
  primero.unref?.();
  const cada = setInterval(tick, TICK_MS);
  cada.unref?.();
}

/* ── Para el panel ──────────────────────────────────────────────────────── */

/** Mandar una campaña a una dirección, sin registrarla. Para verla antes. */
export async function enviarPrueba(
  id: CampanaId,
  to: string,
  nombre: string | null,
): Promise<string | null> {
  const mail = CAMPANAS[id].armar({ nombre, bajaUrl: `${BASE}/correos/baja?prueba=1` });
  const r = await sendEmail({
    to,
    subject: `[prueba] ${mail.asunto}`,
    html: mail.html,
    text: mail.texto,
  });
  return r?.id ?? null;
}

export async function estadoCorreos() {
  const ahora = new Date();
  const campanas = await Promise.all(
    CAMPANAS_IDS.map(async (id) => {
      const [activa, elegiblesAhora, enviados, ultimo] = await Promise.all([
        leerBandera(claveActiva(id)),
        contarElegibles(id, ahora),
        db.emailEnvio.count({ where: { campana: id, resendId: { not: null } } }),
        db.emailEnvio.findFirst({
          where: { campana: id, resendId: { not: null } },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        }),
      ]);
      return {
        id,
        nombre: CAMPANAS[id].nombre,
        descripcion: CAMPANAS[id].descripcion,
        activa,
        elegibles: elegiblesAhora,
        enviados,
        ultimo: ultimo?.createdAt.toISOString() ?? null,
      };
    }),
  );

  const [hoy, ultimos] = await Promise.all([
    enviadosHoy(),
    db.emailEnvio.findMany({
      where: { resendId: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        campana: true,
        createdAt: true,
        user: { select: { email: true, name: true } },
      },
    }),
  ]);

  return {
    arrancado: estado.arrancado,
    corriendo: estado.corriendo,
    hoy,
    topeDiario: TOPE_DIARIO,
    porTanda: POR_TANDA,
    cadaMin: TICK_MS / 60_000,
    ultimoResumen: estado.ultimoResumen,
    campanas,
    ultimos: ultimos.map((e) => ({
      id: e.id,
      campana: e.campana,
      cuando: e.createdAt.toISOString(),
      email: e.user.email ?? "",
      nombre: e.user.name,
    })),
  };
}
