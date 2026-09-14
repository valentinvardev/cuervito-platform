import "server-only";

import type { Prisma } from "../../../generated/prisma";

import { db } from "~/server/db";
import * as P from "./plantillas";

/**
 * Las campañas: quién califica para cada una, y qué se le manda.
 *
 * Una campaña es una condición sobre la cuenta más un mail. La condición se
 * escribe como un `where` de Prisma y se usa para dos cosas con la misma
 * definición: contar cuántos califican hoy (para el panel) y elegir a quiénes
 * mandarles (para el remitente). Si fueran dos consultas escritas aparte, el
 * número del panel y lo que sale se separarían el día que alguien toque una.
 *
 * Todas parten de la misma base: fotógrafos activos, con el alta terminada,
 * con mail, que no se dieron de baja, y que NO recibieron ya esta campaña. Lo
 * último es lo que hace que apagar y prender una campaña no vuelva a mandar
 * nada a nadie: el registro de envío es la memoria.
 */

export const CAMPANAS_IDS = ["sin-mp", "historias", "promo-1", "promo-2", "promo-3"] as const;
export type CampanaId = (typeof CAMPANAS_IDS)[number];

export type Candidato = { id: string; email: string; name: string | null };

export type Campana = {
  id: CampanaId;
  nombre: string;
  descripcion: string;
  donde(ahora: Date): Prisma.UserWhereInput;
  armar(d: P.Destinatario): P.Mail;
  /** Efecto al enviar. La invitación a historias, por ejemplo, la habilita. */
  alEnviar?(userId: string): Promise<void>;
};

const DIA_MS = 24 * 60 * 60_000;
const hace = (ahora: Date, dias: number) => new Date(ahora.getTime() - dias * DIA_MS);

function base(id: CampanaId): Prisma.UserWhereInput {
  return {
    role: "PHOTOGRAPHER",
    status: "ACTIVE",
    email: { not: null },
    onboardingCompletedAt: { not: null },
    emailsPromocionales: true,
    correos: { none: { campana: id } },
  };
}

/** Recibió la campaña anterior hace al menos N días. Es lo que espacia la serie. */
function despuesDe(previa: CampanaId, dias: number, ahora: Date): Prisma.UserWhereInput {
  return { correos: { some: { campana: previa, createdAt: { lt: hace(ahora, dias) } } } };
}

export const CAMPANAS: Record<CampanaId, Campana> = {
  "sin-mp": {
    id: "sin-mp",
    nombre: "No conectó Mercado Pago",
    descripcion:
      "Cuentas con el alta terminada hace más de dos días que todavía no conectaron Mercado Pago. Sin eso la tienda no cobra.",
    // Dos días: el primer día de una cuenta nueva ya tiene el mail de
    // bienvenida y el aviso del panel. Insistir a las tres horas es ruido.
    donde: (ahora) => ({
      ...base("sin-mp"),
      mpConnectedAt: null,
      onboardingCompletedAt: { lt: hace(ahora, 2) },
    }),
    armar: P.sinMp,
  },

  historias: {
    id: "historias",
    nombre: "Tiene fotos, no tiene ventas",
    descripcion:
      "Cuentas con un evento publicado y fotos procesadas, sin ninguna venta, después de tres días. Se les habilita el estudio de historias en el mismo envío.",
    donde: (ahora) => ({
      ...base("historias"),
      onboardingCompletedAt: { lt: hace(ahora, 3) },
      eventsOwned: {
        some: {
          isPublished: true,
          photos: { some: { deletedAt: null, previewKey: { not: null } } },
        },
      },
      sales: { none: { status: "PAID" } },
    }),
    armar: P.historias,
    /* El mail invita a usar el estudio: si al hacer click diera 404, sería
       peor que no invitar. Habilitarlo es parte de mandarlo. */
    alEnviar: async (userId) => {
      await db.user.update({ where: { id: userId }, data: { historiasEnabled: true } });
    },
  },

  "promo-1": {
    id: "promo-1",
    nombre: "Promo 1 · Se encuentra al instante",
    descripcion: "A toda cuenta activa con más de una semana. La primera de tres, una idea por mail.",
    donde: (ahora) => ({
      ...base("promo-1"),
      onboardingCompletedAt: { lt: hace(ahora, 7) },
    }),
    armar: P.promo1,
  },

  "promo-2": {
    id: "promo-2",
    nombre: "Promo 2 · Cobrás vos, no nosotros",
    descripcion: "Una semana después de la promo 1.",
    donde: (ahora) => ({
      AND: [base("promo-2"), despuesDe("promo-1", 7, ahora)],
    }),
    armar: P.promo2,
  },

  "promo-3": {
    id: "promo-3",
    nombre: "Promo 3 · Tu marca, tu dominio",
    descripcion: "Una semana después de la promo 2.",
    donde: (ahora) => ({
      AND: [base("promo-3"), despuesDe("promo-2", 7, ahora)],
    }),
    armar: P.promo3,
  },
};

/** A quiénes les toca ahora, los más antiguos primero. */
export async function elegibles(
  id: CampanaId,
  limite: number,
  ahora = new Date(),
): Promise<Candidato[]> {
  const filas = await db.user.findMany({
    where: CAMPANAS[id].donde(ahora),
    select: { id: true, email: true, name: true },
    orderBy: { createdAt: "asc" },
    take: limite,
  });
  return filas.filter((f): f is Candidato => !!f.email);
}

export function contarElegibles(id: CampanaId, ahora = new Date()): Promise<number> {
  return db.user.count({ where: CAMPANAS[id].donde(ahora) });
}
