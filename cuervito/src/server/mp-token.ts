import "server-only";

import { db } from "~/server/db";
import { MpApiError, refreshAccessToken } from "~/server/mp";

/**
 * La credencial con la que se cobra: el access token de Mercado Pago de cada
 * vendedor.
 *
 * Mercado Pago la vence a los 180 días de la conexión. Se renueva con el
 * refresh token que vino con ella, que es de un solo uso —cada renovación
 * devuelve un par nuevo—, y la documentación la pide «próxima a vencer»:
 * después del vencimiento, lo que queda es volver a autorizar desde el panel.
 *
 * refreshAccessToken() existía desde el primer día y nadie la llamaba.
 * mpTokenExpiresAt se guardaba en cada conexión y nadie la leía. En noviembre
 * de 2026 venció la credencial de un fotógrafo, cada compra de su tienda
 * empezó a fallar con un 401, y nos enteramos cuando él avisó. Este módulo es el que faltaba entre las dos cosas
 * que ya estaban escritas.
 *
 * Dos lectores: el checkout, que pide la credencial para cobrar y la renueva si
 * hace falta en el momento; y el vigía (vigia-pagos.ts), que renueva de
 * antemano las que están por vencer para que el checkout casi nunca tenga que
 * hacerlo él.
 */

/** Con cuánta anticipación se renueva. Mercado Pago da 180 días; renovar a los
 *  165 deja dos semanas de intentos antes de que de verdad deje de cobrar. */
export const RENOVAR_ANTES_DIAS = 15;

export type Renovacion =
  /** Se renovó: credencial y vencimiento nuevos en la fila. */
  | { estado: "renovada"; venceAt: Date }
  /** No hacía falta: vence lejos. */
  | { estado: "vigente"; venceAt: Date | null }
  /** Falló la renovación, pero la credencial de hoy todavía sirve. */
  | { estado: "no-renovada"; venceAt: Date | null; detalle: string }
  /** Falló la renovación y ya venció: con esta cuenta no se puede cobrar. */
  | { estado: "vencida"; venceAt: Date | null; detalle: string }
  | { estado: "sin-conectar" };

export class MpSinCredencial extends Error {
  constructor(
    public readonly motivo: "sin-conectar" | "vencida",
    public readonly userId: string,
    public readonly detalle?: string,
  ) {
    super(
      `Mercado Pago sin credencial para ${userId}: ${motivo}${detalle ? ` (${detalle})` : ""}`,
    );
    this.name = "MpSinCredencial";
  }
}

export function porVencer(venceAt: Date | null, ahora = Date.now()): boolean {
  return venceAt !== null && venceAt.getTime() - ahora < RENOVAR_ANTES_DIAS * 86_400_000;
}

export function vencida(venceAt: Date | null, ahora = Date.now()): boolean {
  return venceAt !== null && venceAt.getTime() <= ahora;
}

const SELECT = { mpAccessToken: true, mpRefreshToken: true, mpTokenExpiresAt: true } as const;

type Resultado = { token: string | null; r: Renovacion };

/**
 * La credencial del vendedor, renovada si está por vencer (o si `forzar`).
 * Lanza MpSinCredencial cuando no hay con qué cobrar.
 */
export async function tokenDeVendedor(
  userId: string,
  opts: { forzar?: boolean } = {},
): Promise<string> {
  const { token, r } = await credencial(userId, !!opts.forzar);
  if (token) return token;
  throw new MpSinCredencial(
    r.estado === "sin-conectar" ? "sin-conectar" : "vencida",
    userId,
    "detalle" in r ? r.detalle : undefined,
  );
}

/** Lo mismo, contado: para el vigía, que no cobra pero quiere saber qué pasó. */
export async function renovarCredencial(userId: string, forzar = false): Promise<Renovacion> {
  return (await credencial(userId, forzar)).r;
}

async function credencial(userId: string, forzar: boolean): Promise<Resultado> {
  const u = await db.user.findUnique({ where: { id: userId }, select: SELECT });
  if (!u?.mpAccessToken) return { token: null, r: { estado: "sin-conectar" } };
  if (!forzar && !porVencer(u.mpTokenExpiresAt)) {
    return { token: u.mpAccessToken, r: { estado: "vigente", venceAt: u.mpTokenExpiresAt } };
  }

  /* Dos renovaciones del mismo vendedor a la vez comparten la misma promesa.
     El updateMany condicionado no alcanza solo: si el rechazo de la segunda
     vuelve antes de que la primera escriba el par nuevo, la segunda ve la
     fila vieja y da por vencida una credencial sana. Con una sola instancia
     (ecosystem.config.cjs), esto lo hace imposible. Idea tomada del stash
     «mp: renovar token y aviso de desconexion» del 11 de octubre de 2026. */
  const enCurso = renovando.get(userId);
  if (enCurso) return enCurso;
  const p = renovar(userId, u).finally(() => renovando.delete(userId));
  renovando.set(userId, p);
  return p;
}

const renovando = new Map<string, Promise<Resultado>>();

async function renovar(
  userId: string,
  u: { mpAccessToken: string | null; mpRefreshToken: string | null; mpTokenExpiresAt: Date | null },
): Promise<Resultado> {
  if (!u.mpRefreshToken) {
    const detalle = "la conexión no trajo refresh token";
    return vencida(u.mpTokenExpiresAt)
      ? { token: null, r: { estado: "vencida", venceAt: u.mpTokenExpiresAt, detalle } }
      : { token: u.mpAccessToken, r: { estado: "no-renovada", venceAt: u.mpTokenExpiresAt, detalle } };
  }

  try {
    const nuevo = await refreshAccessToken(u.mpRefreshToken);
    const venceAt = new Date(Date.now() + nuevo.expiresInSeconds * 1000);
    /* El refresh token es de un solo uso, así que la fila sólo se pisa si
       todavía tiene el que acabamos de gastar. Si no lo tiene, otro pedido
       renovó entre nuestra lectura y nuestra escritura: la suya es la buena. */
    const { count } = await db.user.updateMany({
      where: { id: userId, mpRefreshToken: u.mpRefreshToken },
      data: {
        mpAccessToken: nuevo.accessToken,
        mpRefreshToken: nuevo.refreshToken,
        mpTokenExpiresAt: venceAt,
      },
    });
    if (count === 0) {
      const ajena = await laDeOtro(userId, u.mpRefreshToken);
      if (ajena) return ajena;
    }
    console.log(
      `[mp token] renovada la credencial de ${userId}; vence ${venceAt.toISOString().slice(0, 10)}`,
    );
    return { token: nuevo.accessToken, r: { estado: "renovada", venceAt } };
  } catch (e) {
    /* Dos compras a la vez en la ventana de renovación gastan el mismo refresh
       token; Mercado Pago le dice que no al segundo. Si la fila ya cambió, el
       primero ganó y su credencial sirve para los dos. */
    const ajena = await laDeOtro(userId, u.mpRefreshToken);
    if (ajena) return ajena;

    const detalle =
      e instanceof MpApiError ? `${e.status} ${e.cuerpo}` : e instanceof Error ? e.message : String(e);
    if (vencida(u.mpTokenExpiresAt)) {
      return { token: null, r: { estado: "vencida", venceAt: u.mpTokenExpiresAt, detalle } };
    }
    console.warn(`[mp token] no se pudo renovar la credencial de ${userId}, todavía vigente:`, detalle);
    return { token: u.mpAccessToken, r: { estado: "no-renovada", venceAt: u.mpTokenExpiresAt, detalle } };
  }
}

/** Si la fila ya no tiene el refresh token que leímos, alguien renovó primero. */
async function laDeOtro(userId: string, refreshGastado: string): Promise<Resultado | null> {
  const ahora = await db.user.findUnique({ where: { id: userId }, select: SELECT });
  if (ahora?.mpAccessToken && ahora.mpRefreshToken && ahora.mpRefreshToken !== refreshGastado) {
    return {
      token: ahora.mpAccessToken,
      r: { estado: "renovada", venceAt: ahora.mpTokenExpiresAt ?? new Date() },
    };
  }
  return null;
}
