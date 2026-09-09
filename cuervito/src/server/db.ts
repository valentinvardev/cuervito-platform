import { env } from "~/env";
import { PrismaClient } from "../../generated/prisma";

const createPrismaClient = () =>
  new PrismaClient({
    log:
      env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const db = globalForPrisma.prisma ?? createPrismaClient();

/* SIEMPRE en globalThis, también en producción.

   Antes esto era sólo para desarrollo, para que el recargado en caliente no
   dejara clientes colgados. Ahora hace falta en producción por otro motivo:
   instrumentation.ts —donde arranca el procesador— y los route handlers se
   compilan en capas distintas de webpack, así que un módulo importado desde
   los dos lados se evalúa DOS veces. Sin el global serían dos PrismaClient con
   connection_limit=10 cada uno contra un pooler que da 10. */
globalForPrisma.prisma = db;
